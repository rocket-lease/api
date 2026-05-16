import { ReservationService } from '@/application/reservation.service';
import { InMemoryReservationRepository } from '@/infrastructure/repository/in_memory.reservation.repository';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import type { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import type {
  UserRepository,
  UserProfile,
} from '@/domain/repositories/user.repository';
import { Clock } from '@/domain/providers/clock.provider';
import { randomUUID } from 'node:crypto';
import {
  ContractNotAcceptedException,
  HoldExpiredException,
  OwnerCannotReserveOwnVehicleException,
  ReservationForbiddenException,
  ReservationNotFoundException,
  VehicleNotAvailableException,
} from '@/domain/exceptions/reservation.exception';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';

class FakeClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return this.current;
  }
  set(date: Date) {
    this.current = date;
  }
  advanceMs(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

function makeVehicle(overrides: { ownerId?: string; enabled?: boolean } = {}): Vehicle {
  return new Vehicle(
    randomUUID(),
    overrides.ownerId ?? randomUUID(),
    'AE987CC',
    'Ford',
    'Ranger',
    2023,
    5,
    400,
    'Manual',
    false,
    overrides.enabled ?? true,
    ['https://i.com/1.jpg'],
    [],
    'Azul',
    50000,
    24000,
    null,
    'B',
    'CABA',
    '2026-06-01',
  );
}

function makeProfile(id: string): UserProfile {
  return {
    id,
    name: 'Owner',
    email: 'o@e.com',
    phone: '1',
    avatarUrl: null,
    verificationStatus: 'verified',
    level: 'bronze',
    reputationScore: 0,
    preferences: {
      transmission: null,
      accessibility: [],
      maxPriceDaily: null,
    },
  };
}

function makeVehicleRepo(vehicles: Vehicle[]): jest.Mocked<VehicleRepository> {
  return {
    save: jest.fn(),
    fetchAll: jest.fn().mockResolvedValue(vehicles),
    findById: jest.fn(async (id: string) =>
      vehicles.find((v) => v.getId() === id) ?? null,
    ),
    findByPlate: jest.fn(),
    findByOwnerId: jest.fn(),
    findByCharacteristics: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<VehicleRepository>;
}

function makeUserRepo(): jest.Mocked<UserRepository> {
  return {
    save: jest.fn(),
    updateBasicInfo: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    getProfileById: jest.fn(async (id: string) => makeProfile(id)),
    updateProfile: jest.fn(),
    updateAvatar: jest.fn(),
    deleteById: jest.fn(),
    markPhoneVerified: jest.fn(),
    isPhoneVerified: jest.fn(),
  } as unknown as jest.Mocked<UserRepository>;
}

describe('ReservationService', () => {
  let repo: InMemoryReservationRepository;
  let vehicleRepo: jest.Mocked<VehicleRepository>;
  let userRepo: jest.Mocked<UserRepository>;
  let clock: FakeClock;
  let service: ReservationService;
  let vehicle: Vehicle;
  const conductorA = randomUUID();
  const conductorB = randomUUID();
  const start = '2026-06-02T10:00:00.000Z';
  const end = '2026-06-04T10:00:00.000Z';

  beforeEach(() => {
    vehicle = makeVehicle();
    repo = new InMemoryReservationRepository();
    vehicleRepo = makeVehicleRepo([vehicle]);
    userRepo = makeUserRepo();
    clock = new FakeClock(new Date('2026-06-01T10:00:00Z'));
    service = new ReservationService(repo, vehicleRepo, userRepo, clock);
  });

  it('creates a hold for valid request', async () => {
    const res = await service.createReservation(conductorA, {
      vehicleId: vehicle.getId(),
      startAt: start,
      endAt: end,
      contractAccepted: true,
    });
    expect(res.status).toBe('pending_payment');
    expect(res.totalCents).toBe(2 * 24000);
    expect(new Date(res.holdExpiresAt).getTime()).toBe(
      clock.now().getTime() + 10 * 60 * 1000,
    );
  });

  it('rejects when contractAccepted is false', async () => {
    await expect(
      service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: false as unknown as true,
      }),
    ).rejects.toThrow(ContractNotAcceptedException);
  });

  it('rejects when vehicle not found', async () => {
    await expect(
      service.createReservation(conductorA, {
        vehicleId: randomUUID(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('rejects when conductor is the owner', async () => {
    const ownedByA = makeVehicle({ ownerId: conductorA });
    vehicleRepo = makeVehicleRepo([ownedByA]);
    service = new ReservationService(repo, vehicleRepo, userRepo, clock);
    await expect(
      service.createReservation(conductorA, {
        vehicleId: ownedByA.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      }),
    ).rejects.toThrow(OwnerCannotReserveOwnVehicleException);
  });

  it('rejects when vehicle is disabled', async () => {
    const disabled = makeVehicle({ enabled: false });
    vehicleRepo = makeVehicleRepo([disabled]);
    service = new ReservationService(repo, vehicleRepo, userRepo, clock);
    await expect(
      service.createReservation(conductorA, {
        vehicleId: disabled.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      }),
    ).rejects.toThrow(VehicleNotAvailableException);
  });

  it('rejects when overlapping reservation exists', async () => {
    await service.createReservation(conductorA, {
      vehicleId: vehicle.getId(),
      startAt: start,
      endAt: end,
      contractAccepted: true,
    });
    await expect(
      service.createReservation(conductorB, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      }),
    ).rejects.toThrow(VehicleNotAvailableException);
  });

  it('detects partial overlaps', async () => {
    await service.createReservation(conductorA, {
      vehicleId: vehicle.getId(),
      startAt: '2026-06-01T10:00:00.000Z',
      endAt: '2026-06-05T10:00:00.000Z',
      contractAccepted: true,
    });
    await expect(
      service.createReservation(conductorB, {
        vehicleId: vehicle.getId(),
        startAt: '2026-06-04T10:00:00.000Z',
        endAt: '2026-06-07T10:00:00.000Z',
        contractAccepted: true,
      }),
    ).rejects.toThrow(VehicleNotAvailableException);
  });

  describe('confirmPayment', () => {
    it('confirms pending_payment before hold expiry', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      clock.advanceMs(2 * 60 * 1000);
      const res = await service.confirmPayment(conductorA, created.id, {
        paymentMethod: 'credit_card',
      });
      expect(res.status).toBe('confirmed');
    });

    it('rejects after hold expiry and marks expired', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      clock.advanceMs(11 * 60 * 1000);
      await expect(
        service.confirmPayment(conductorA, created.id, {
          paymentMethod: 'credit_card',
        }),
      ).rejects.toThrow(HoldExpiredException);
      const r = await repo.findById(created.id);
      expect(r?.getStatus()).toBe('expired');
    });

    it('rejects when called by a different conductor', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await expect(
        service.confirmPayment(conductorB, created.id, {
          paymentMethod: 'credit_card',
        }),
      ).rejects.toThrow(ReservationForbiddenException);
    });

    it('returns NotFound when reservation missing', async () => {
      await expect(
        service.confirmPayment(conductorA, randomUUID(), {
          paymentMethod: 'credit_card',
        }),
      ).rejects.toThrow(ReservationNotFoundException);
    });
  });

  describe('expireOverdueHolds', () => {
    it('marks overdue holds as expired and frees the vehicle', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      clock.advanceMs(11 * 60 * 1000);
      const expired = await service.expireOverdueHolds();
      expect(expired).toBe(1);
      const r = await repo.findById(created.id);
      expect(r?.getStatus()).toBe('expired');
      // Now another conductor can reserve the same dates
      const res = await service.createReservation(conductorB, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      expect(res.status).toBe('pending_payment');
    });
  });

  describe('cancelHoldsForVehicle', () => {
    it('cancels pending holds and leaves confirmed intact', async () => {
      const a = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: '2026-06-02T10:00:00.000Z',
        endAt: '2026-06-03T10:00:00.000Z',
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, a.id, {
        paymentMethod: 'credit_card',
      });
      const b = await service.createReservation(conductorB, {
        vehicleId: vehicle.getId(),
        startAt: '2026-06-10T10:00:00.000Z',
        endAt: '2026-06-12T10:00:00.000Z',
        contractAccepted: true,
      });
      const cancelled = await service.cancelHoldsForVehicle(vehicle.getId());
      expect(cancelled).toBe(1);
      expect((await repo.findById(a.id))?.getStatus()).toBe('confirmed');
      expect((await repo.findById(b.id))?.getStatus()).toBe('cancelled');
    });
  });
});
