import { ReservationService } from '@/application/reservation.service';
import { InMemoryReservationRepository } from '@/infrastructure/repository/in_memory.reservation.repository';
import { InMemoryReservationRuleSetRepository } from '@/infrastructure/repository/in_memory.reservation-rule-set.repository';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { Reservation } from '@/domain/entities/reservation.entity';
import type { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import type { ReservationRuleSetRepository } from '@/domain/repositories/reservation-rule-set.repository';
import type {
  UserRepository,
  UserProfile,
} from '@/domain/repositories/user.repository';
import { Clock } from '@/domain/providers/clock.provider';
import { IdentityService } from '@/application/identity.service';
import { DriverLicenseService } from '@/application/driver-license.service';
import type { VoucherProvider } from '@/domain/providers/voucher.provider';
import type { NotificationProvider } from '@/domain/providers/notification.provider';
import type { PaymentGatewayProvider } from '@/domain/providers/payment-gateway.provider';
import type { EmailProvider } from '@/domain/providers/email.provider';
import { randomUUID } from 'node:crypto';
import {
  ContractNotAcceptedException,
  ExtensionInvalidEndAtException,
  ExtensionNotPendingException,
  ExtensionParentNotInProgressException,
  HoldExpiredException,
  PendingExtensionExistsException,
  InvalidQrTokenException,
  OwnerCannotReserveOwnVehicleException,
  ReservationForbiddenException,
  ReservationNotFoundException,
  VehicleNotAvailableException,
  VoucherNotFoundException,
  VoucherReservationCancelledException,
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

function makeVehicle(
  overrides: {
    ownerId?: string;
    enabled?: boolean;
    autoAccept?: boolean | null;
    reservationRuleSetId?: string | null;
  } = {},
): Vehicle {
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
    'reservationRuleSetId' in overrides ? overrides.reservationRuleSetId ?? null : null,
    'autoAccept' in overrides ? overrides.autoAccept! : true,
  );
}

function makeProfile(id: string, autoAccept = false, balanceInCents = 0): UserProfile {
  return {
    id,
    name: 'Owner',
    email: 'o@e.com',
    phone: '1',
    avatarUrl: null,
    verificationStatus: 'verified',
    level: 'bronze',
    reputationScore: 0,
    balanceInCents,
    preferences: {
      transmission: null,
      accessibility: [],
      maxPriceDaily: null,
    },
    autoAccept,
  };
}

function makeVehicleRepo(vehicles: Vehicle[]): jest.Mocked<VehicleRepository> {
  return {
    save: jest.fn(),
    fetchAll: jest.fn().mockResolvedValue(vehicles),
    findById: jest.fn(async (id: string) =>
      vehicles.find((v) => v.getId() === id) ?? null,
    ),
    findByIds: jest.fn(async (ids: string[]) =>
      vehicles.filter((v) => ids.includes(v.getId())),
    ),
    findByPlate: jest.fn(),
    findByOwnerId: jest.fn(),
    findByCharacteristics: jest.fn(),
    delete: jest.fn(),
    bulkUpdatePrices: jest.fn(),
    countActiveReservationsByVehicleIds: jest.fn(),
  };
}

function makeVoucherProvider(): jest.Mocked<VoucherProvider> {
  return {
    generateVoucher: jest.fn().mockResolvedValue({ qrCode: 'QR-test' }),
  };
}

function makeNotificationProvider(): jest.Mocked<NotificationProvider> {
  return {
    notify: jest.fn().mockResolvedValue(undefined),
  };
}

function makePaymentGatewayProvider(): jest.Mocked<PaymentGatewayProvider> {
  return {
    processPayment: jest.fn().mockResolvedValue({ success: true, transactionId: 'txn-test' }),
    generateTransferCode: jest.fn().mockResolvedValue({ code: 'CBU-test-code', alias: 'rocket.lease.1' }),
  };
}

function makeUserRepo(): jest.Mocked<UserRepository> {
  const balancesByUser = new Map<string, number>();
  return {
    save: jest.fn(),
    updateBasicInfo: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    getProfileById: jest.fn(async (id: string) =>
      makeProfile(id, false, balancesByUser.get(id) ?? 0),
    ),
    findProfilesByIds: jest.fn(async (ids: string[]) =>
      ids.map((id) => makeProfile(id, false, balancesByUser.get(id) ?? 0)),
    ),
    updateProfile: jest.fn(),
    updateAvatar: jest.fn(),
    creditBalance: jest.fn(async (id: string, amountInCents: number) => {
      const next = (balancesByUser.get(id) ?? 0) + amountInCents;
      balancesByUser.set(id, next);
      return makeProfile(id, false, next);
    }),
    deleteById: jest.fn(),
    markPhoneVerified: jest.fn(),
    isPhoneVerified: jest.fn(),
    updateAutoAccept: jest.fn(),
  };
}

function makeRuleSet(policy: 'FLEXIBLE' | 'MODERATE' | 'STRICT', id = randomUUID()) {
  return {
    getId: () => id,
    getRentalorId: () => randomUUID(),
    getName: () => 'Reglas',
    getDescription: () => null,
    getCancellationPolicy: () => policy,
    getDepositPercentage: () => 10,
    getMaxKilometrage: () => ({ type: 'UNLIMITED' as const }),
    getRentalTimeConstraints: () => ({}),
    getVehicleCount: () => 0,
    getCreatedAt: () => new Date('2026-05-01T00:00:00Z'),
    getUpdatedAt: () => new Date('2026-05-01T00:00:00Z'),
  } as any;
}

function makeReservationRuleSetRepo(): jest.Mocked<ReservationRuleSetRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(async (_id: string) => null),
    findByOwnerId: jest.fn(),
    findPrivateByVehicleId: jest.fn(async (_id: string) => null),
    delete: jest.fn(),
  };
}

describe('ReservationService', () => {
  let repo: InMemoryReservationRepository;
  let ruleSetRepo: InMemoryReservationRuleSetRepository;
  let vehicleRepo: jest.Mocked<VehicleRepository>;
  let userRepo: jest.Mocked<UserRepository>;
  let reservationRuleSetRepo: jest.Mocked<ReservationRuleSetRepository>;
  let clock: FakeClock;
  let voucherProvider: jest.Mocked<VoucherProvider>;
  let notificationProvider: jest.Mocked<NotificationProvider>;
  let paymentGateway: jest.Mocked<PaymentGatewayProvider>;
  let service: ReservationService;
  let emailProvider: jest.Mocked<EmailProvider>;
  let identityService: jest.Mocked<Pick<IdentityService, 'assertVerified'>>;
  let driverLicenseService: jest.Mocked<Pick<DriverLicenseService, 'assertVerified'>>;
  let vehicle: Vehicle;
  const conductorA = randomUUID();
  const conductorB = randomUUID();
  const start = '2026-06-02T10:00:00.000Z';
  const end = '2026-06-04T10:00:00.000Z';

  beforeEach(() => {
    vehicle = makeVehicle();
    repo = new InMemoryReservationRepository();
    ruleSetRepo = new InMemoryReservationRuleSetRepository();
    vehicleRepo = makeVehicleRepo([vehicle]);
    userRepo = makeUserRepo();
    reservationRuleSetRepo = makeReservationRuleSetRepo();
    clock = new FakeClock(new Date('2026-06-01T10:00:00Z'));
    voucherProvider = makeVoucherProvider();
    notificationProvider = makeNotificationProvider();
    paymentGateway = makePaymentGatewayProvider();
    emailProvider = { sendVoucherEmail: jest.fn().mockResolvedValue(undefined) };
    identityService = { assertVerified: jest.fn().mockResolvedValue(undefined) };
    driverLicenseService = { assertVerified: jest.fn().mockResolvedValue(undefined) };
    service = new ReservationService(
      repo,
      vehicleRepo,
      userRepo,
      ruleSetRepo,
      clock,
      voucherProvider,
      notificationProvider,
      paymentGateway,
      emailProvider,
      identityService,
      driverLicenseService,
    );
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
        contractAccepted: false,
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
    service = new ReservationService(
      repo,
      vehicleRepo,
      userRepo,
      ruleSetRepo,
      clock,
      voucherProvider,
      notificationProvider,
      paymentGateway,
      emailProvider,
      identityService,
      driverLicenseService,
    );
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
    service = new ReservationService(
      repo,
      vehicleRepo,
      userRepo,
      ruleSetRepo,
      clock,
      voucherProvider,
      notificationProvider,
      paymentGateway,
      emailProvider,
      identityService,
      driverLicenseService,
    );
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

  it('permite reservar el mismo rango luego de cancelar la reserva activa', async () => {
    const first = await service.createReservation(conductorA, {
      vehicleId: vehicle.getId(),
      startAt: start,
      endAt: end,
      contractAccepted: true,
    });
    await service.confirmPayment(conductorA, first.id, {
      paymentMethod: 'credit_card',
    });
    await service.cancelReservation(conductorA, first.id);

    const second = await service.createReservation(conductorB, {
      vehicleId: vehicle.getId(),
      startAt: start,
      endAt: end,
      contractAccepted: true,
    });

    expect(second.status).toBe('pending_payment');
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

  describe('rules snapshot on confirmation (US-49)', () => {
    it('persists defaults when vehicle has no rule set', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, created.id, {
        paymentMethod: 'credit_card',
      });

      const r = await repo.findById(created.id);
      expect(r?.getDepositPercentageSnapshot()).toBeNull();
      expect(r?.getCancellationPolicySnapshot()).toBe('FLEXIBLE');
      expect(r?.getMaxKilometrageSnapshot()).toEqual({ type: 'UNLIMITED' });
      expect(r?.getRentalTimeConstraintsSnapshot().minDays).toBe(1);
      expect(r?.getBasePriceCentsSnapshot()).toBe(24000);
    });

    it('persists deposit + rules from the shared set assigned to the vehicle', async () => {
      const ruleSetId = randomUUID();
      const sharedSet = new (
        await import('@/domain/entities/reservation-rule-set.entity')
      ).ReservationRuleSet(
        vehicle.getOwnerId(),
        null,
        'Premium',
        null,
        'MODERATE',
        30,
        { type: 'LIMITED', value: 200 },
        { minDays: 2, maxDays: 14 },
        0,
        new Date(),
        new Date(),
        ruleSetId,
      );
      await ruleSetRepo.save(sharedSet);
      // Asociar el set al vehículo.
      vehicle.update({ reservationRuleSetId: ruleSetId });

      const created = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, created.id, {
        paymentMethod: 'credit_card',
      });

      const r = await repo.findById(created.id);
      expect(r?.getDepositPercentageSnapshot()).toBe(30);
      expect(r?.getCancellationPolicySnapshot()).toBe('MODERATE');
      expect(r?.getMaxKilometrageSnapshot()).toEqual({
        type: 'LIMITED',
        value: 200,
      });
      expect(r?.getRentalTimeConstraintsSnapshot()).toEqual({
        minDays: 2,
        maxDays: 14,
      });
    });

    it('later changes to the rule set do NOT affect confirmed reservation snapshot', async () => {
      const ruleSetId = randomUUID();
      const sharedSet = new (
        await import('@/domain/entities/reservation-rule-set.entity')
      ).ReservationRuleSet(
        vehicle.getOwnerId(),
        null,
        'Premium',
        null,
        'FLEXIBLE',
        null,
        { type: 'UNLIMITED' },
        { minDays: 1 },
        0,
        new Date(),
        new Date(),
        ruleSetId,
      );
      await ruleSetRepo.save(sharedSet);
      vehicle.update({ reservationRuleSetId: ruleSetId });

      const created = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, created.id, {
        paymentMethod: 'credit_card',
      });

      // Tras confirmar, el rentador cambia el set: agrega 50% de seña.
      sharedSet.update({ depositPercentage: 50 });
      await ruleSetRepo.save(sharedSet);

      const r = await repo.findById(created.id);
      expect(r?.getDepositPercentageSnapshot()).toBeNull();
    });

    it('private rule set takes precedence over shared when both exist', async () => {
      const sharedId = randomUUID();
      const privateId = randomUUID();
      const shared = new (
        await import('@/domain/entities/reservation-rule-set.entity')
      ).ReservationRuleSet(
        vehicle.getOwnerId(),
        null,
        'Shared',
        null,
        'FLEXIBLE',
        10,
        { type: 'UNLIMITED' },
        { minDays: 1 },
        0,
        new Date(),
        new Date(),
        sharedId,
      );
      const priv = new (
        await import('@/domain/entities/reservation-rule-set.entity')
      ).ReservationRuleSet(
        vehicle.getOwnerId(),
        vehicle.getId(),
        'Private',
        null,
        'STRICT',
        40,
        { type: 'UNLIMITED' },
        { minDays: 1 },
        0,
        new Date(),
        new Date(),
        privateId,
      );
      await ruleSetRepo.save(shared);
      await ruleSetRepo.save(priv);
      vehicle.update({ reservationRuleSetId: sharedId });

      const created = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, created.id, {
        paymentMethod: 'credit_card',
      });

      const r = await repo.findById(created.id);
      expect(r?.getDepositPercentageSnapshot()).toBe(40);
      expect(r?.getCancellationPolicySnapshot()).toBe('STRICT');
    });
  });

  describe('expireOverdueReservations', () => {
    it('marks overdue holds as expired and frees the vehicle', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      clock.advanceMs(11 * 60 * 1000);
      const expired = await service.expireOverdueReservations();
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

  describe('cancelPendingByVehicle', () => {
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
      const cancelled = await service.cancelPendingByVehicle(vehicle.getId());
      expect(cancelled).toBe(1);
      expect((await repo.findById(a.id))?.getStatus()).toBe('confirmed');
      expect((await repo.findById(b.id))?.getStatus()).toBe('cancelled');
    });
  });

  describe('list (endpoint unificado GET /reservations)', () => {
    const ownerId = randomUUID();

    async function seedReservations(count: number): Promise<void> {
      const created: Vehicle[] = [];
      for (let i = 0; i < count; i++) {
        const v = new Vehicle(
          randomUUID(),
          ownerId,
          `AE${String(100 + i).padStart(3, '0')}AA`,
          'Ford',
          'Ranger',
          2023,
          5,
          400,
          'Manual',
          false,
          true,
          ['https://i.com/1.jpg'],
          [],
          'Azul',
          50000,
          24000,
          null,
          'B',
          'CABA',
          '2026-06-01',
          null,
          true,
        );
        created.push(v);
        vehicleRepo.findById.mockImplementation(async (id: string) =>
          created.find((x) => x.getId() === id) ?? null,
        );
        vehicleRepo.findByIds.mockImplementation(async (ids: string[]) =>
          created.filter((x) => ids.includes(x.getId())),
        );
        await service.createReservation(randomUUID(), {
          vehicleId: v.getId(),
          startAt: new Date(Date.UTC(2026, 6, i * 3 + 1, 10)).toISOString(),
          endAt: new Date(Date.UTC(2026, 6, i * 3 + 2, 10)).toISOString(),
          contractAccepted: true,
        });
      }
    }

    it('role=owner: lista vacía con total=0 cuando no hay reservas', async () => {
      const result = await service.list(ownerId, {
        role: 'owner',
        page: 1,
        pageSize: 20,
      });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('role=owner: hidrata vehicle + conductor + rentador', async () => {
      await seedReservations(2);
      const result = await service.list(ownerId, {
        role: 'owner',
        page: 1,
        pageSize: 20,
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0].vehicle.brand).toBe('Ford');
      expect(result.items[0].conductor).toBeDefined();
      expect(result.items[0].rentador).toBeDefined();
    });

    it('role=conductor: filtra por conductor_id (no por rentador_id)', async () => {
      const spy = jest.spyOn(repo, 'findByUser');
      const conductorId = randomUUID();
      await service.list(conductorId, {
        role: 'conductor',
        page: 1,
        pageSize: 20,
      });
      expect(spy).toHaveBeenCalledWith(
        conductorId,
        'conductor',
        expect.anything(),
      );
    });

    it('role=owner: filtra por rentador_id', async () => {
      const spy = jest.spyOn(repo, 'findByUser');
      await service.list(ownerId, { role: 'owner', page: 1, pageSize: 20 });
      expect(spy).toHaveBeenCalledWith(ownerId, 'owner', expect.anything());
    });

    it('usa batch — no llama findById por item (no N+1)', async () => {
      await seedReservations(3);
      vehicleRepo.findByIds.mockClear();
      vehicleRepo.findById.mockClear();
      userRepo.findProfilesByIds.mockClear();
      userRepo.getProfileById.mockClear();

      await service.list(ownerId, { role: 'owner', page: 1, pageSize: 20 });

      expect(vehicleRepo.findByIds).toHaveBeenCalledTimes(1);
      expect(userRepo.findProfilesByIds).toHaveBeenCalledTimes(1);
      expect(vehicleRepo.findById).not.toHaveBeenCalled();
      expect(userRepo.getProfileById).not.toHaveBeenCalled();
    });

    it('propaga filtro de status al repository', async () => {
      const spy = jest.spyOn(repo, 'findByUser');
      await service.list(ownerId, {
        role: 'owner',
        status: ['confirmed', 'in_progress'],
        page: 1,
        pageSize: 20,
      });
      expect(spy).toHaveBeenCalledWith(
        ownerId,
        'owner',
        expect.objectContaining({ status: ['confirmed', 'in_progress'] }),
      );
    });

    it('propaga filtros de fecha al repository convertidos a Date', async () => {
      const spy = jest.spyOn(repo, 'findByUser');
      await service.list(ownerId, {
        role: 'owner',
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-31T23:59:59.000Z',
        page: 1,
        pageSize: 20,
      });
      const call = spy.mock.calls[0][2];
      expect(call.from).toBeInstanceOf(Date);
      expect(call.to).toBeInstanceOf(Date);
      expect(call.from?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
      expect(call.to?.toISOString()).toBe('2026-05-31T23:59:59.000Z');
    });

    it('respeta paginación', async () => {
      const spy = jest.spyOn(repo, 'findByUser');
      await service.list(ownerId, { role: 'owner', page: 2, pageSize: 10 });
      expect(spy).toHaveBeenCalledWith(
        ownerId,
        'owner',
        expect.objectContaining({ page: 2, pageSize: 10 }),
      );
    });

    it('devuelve page y pageSize tal como vinieron en el request', async () => {
      const result = await service.list(ownerId, {
        role: 'owner',
        page: 3,
        pageSize: 5,
      });
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(5);
    });
  });

  describe('US-40 — pending_approval flow', () => {
    function makeVehicleWithAutoAccept(autoAccept: boolean | null): Vehicle {
      return makeVehicle({ autoAccept });
    }

    it('createReservation con vehicle.autoAccept = true => pending_payment con TTL 10min', async () => {
      const v = makeVehicleWithAutoAccept(true);
      vehicleRepo = makeVehicleRepo([v]);
      service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);
      const res = await service.createReservation(conductorA, {
        vehicleId: v.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });

      expect(res.status).toBe('pending_payment');
      expect(new Date(res.holdExpiresAt).getTime()).toBe(
        clock.now().getTime() + 10 * 60 * 1000,
      );
    });

    it('createReservation con vehicle.autoAccept = false => pending_approval con TTL 24h', async () => {
      const v = makeVehicleWithAutoAccept(false);
      vehicleRepo = makeVehicleRepo([v]);
      service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);
      const res = await service.createReservation(conductorA, {
        vehicleId: v.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });

      expect(res.status).toBe('pending_approval');
      expect(new Date(res.holdExpiresAt).getTime()).toBe(
        clock.now().getTime() + 24 * 60 * 60 * 1000,
      );
    });

    it('createReservation con vehicle.autoAccept = null hereda owner.autoAccept = true', async () => {
      const v = makeVehicleWithAutoAccept(null);
      vehicleRepo = makeVehicleRepo([v]);
      userRepo.getProfileById = jest.fn(async (id: string) =>
        makeProfile(id, true),
      );
      service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);
      const res = await service.createReservation(conductorA, {
        vehicleId: v.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });

      expect(res.status).toBe('pending_payment');
    });

    it('createReservation con vehicle.autoAccept = null y owner.autoAccept = false => pending_approval', async () => {
      const v = makeVehicleWithAutoAccept(null);
      vehicleRepo = makeVehicleRepo([v]);
      userRepo.getProfileById = jest.fn(async (id: string) =>
        makeProfile(id, false),
      );
      service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);
      const res = await service.createReservation(conductorA, {
        vehicleId: v.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });

      expect(res.status).toBe('pending_approval');
    });

    describe('approve', () => {
      let manualVehicle: Vehicle;
      let rentadorId: string;

      beforeEach(() => {
        rentadorId = randomUUID();
        manualVehicle = makeVehicle({
          ownerId: rentadorId,
          autoAccept: false,
        });
        vehicleRepo = makeVehicleRepo([manualVehicle]);
        service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);      });

      it('happy path: pending_approval => pending_payment con hold de 10 min', async () => {
        const created = await service.createReservation(conductorA, {
          vehicleId: manualVehicle.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });
        expect(created.status).toBe('pending_approval');

        const res = await service.approve(rentadorId, created.id);

        expect(res.status).toBe('pending_payment');
        expect(new Date(res.holdExpiresAt!).getTime()).toBe(
          clock.now().getTime() + 10 * 60 * 1000,
        );
        const after = await repo.findById(created.id);
        expect(after?.getStatus()).toBe('pending_payment');
      });

      it('forbidden cuando lo intenta otro rentador', async () => {
        const created = await service.createReservation(conductorA, {
          vehicleId: manualVehicle.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });
        const otroRentador = randomUUID();
        await expect(service.approve(otroRentador, created.id)).rejects.toThrow(
          ReservationForbiddenException,
        );
      });

      it('rechaza cuando la reserva no está en pending_approval (ej: ya confirmed)', async () => {
        const auto = makeVehicle({
          ownerId: rentadorId,
          autoAccept: true,
        });
        vehicleRepo = makeVehicleRepo([auto]);
        service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);        const created = await service.createReservation(conductorA, {
          vehicleId: auto.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });
        await service.confirmPayment(conductorA, created.id, {
          paymentMethod: 'credit_card',
        });
        await expect(service.approve(rentadorId, created.id)).rejects.toThrow(
          /invalid reservation transition/,
        );
      });

      it('aprueba A y auto-rechaza en cascada las solicitudes solapadas con razón autogenerada', async () => {
        const a = await service.createReservation(conductorA, {
          vehicleId: manualVehicle.getId(),
          startAt: '2026-06-02T10:00:00.000Z',
          endAt: '2026-06-05T10:00:00.000Z',
          contractAccepted: true,
        });
        const b = await service.createReservation(conductorB, {
          vehicleId: manualVehicle.getId(),
          startAt: '2026-06-04T10:00:00.000Z',
          endAt: '2026-06-07T10:00:00.000Z',
          contractAccepted: true,
        });

        await service.approve(rentadorId, a.id);

        const aAfter = await repo.findById(a.id);
        const bAfter = await repo.findById(b.id);
        expect(aAfter?.getStatus()).toBe('pending_payment');
        expect(bAfter?.getStatus()).toBe('rejected');
        expect(bAfter?.getRejectionReason()).toMatch(/solapan/);
      });

      it('no toca solicitudes pending_approval de OTROS vehículos', async () => {
        const other = makeVehicle({
          ownerId: rentadorId,
          autoAccept: false,
        });
        vehicleRepo = makeVehicleRepo([manualVehicle, other]);
        service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);
        const a = await service.createReservation(conductorA, {
          vehicleId: manualVehicle.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });
        const b = await service.createReservation(conductorB, {
          vehicleId: other.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });

        await service.approve(rentadorId, a.id);

        const bAfter = await repo.findById(b.id);
        expect(bAfter?.getStatus()).toBe('pending_approval');
      });
    });

    describe('reject', () => {
      let manualVehicle: Vehicle;
      let rentadorId: string;

      beforeEach(() => {
        rentadorId = randomUUID();
        manualVehicle = makeVehicle({
          ownerId: rentadorId,
          autoAccept: false,
        });
        vehicleRepo = makeVehicleRepo([manualVehicle]);
        service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);      });

      it('rechaza con razón => status rejected y rejectionReason persiste', async () => {
        const created = await service.createReservation(conductorA, {
          vehicleId: manualVehicle.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });
        const res = await service.reject(
          rentadorId,
          created.id,
          'Vehículo en mantenimiento',
        );
        expect(res.status).toBe('rejected');
        expect(res.rejectionReason).toBe('Vehículo en mantenimiento');
        const after = await repo.findById(created.id);
        expect(after?.getRejectionReason()).toBe('Vehículo en mantenimiento');
      });

      it('rechaza sin razón => rejectionReason null', async () => {
        const created = await service.createReservation(conductorA, {
          vehicleId: manualVehicle.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });
        const res = await service.reject(rentadorId, created.id, null);
        expect(res.status).toBe('rejected');
        expect(res.rejectionReason).toBeNull();
      });

      it('forbidden cuando lo intenta otro rentador', async () => {
        const created = await service.createReservation(conductorA, {
          vehicleId: manualVehicle.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });
        await expect(
          service.reject(randomUUID(), created.id, null),
        ).rejects.toThrow(ReservationForbiddenException);
      });
    });

    describe('cancelReservation desde pending_approval', () => {
      it('el conductor retira su solicitud y queda cancelled', async () => {
        const rentadorId = randomUUID();
        const v = makeVehicle({ ownerId: rentadorId, autoAccept: false });
        vehicleRepo = makeVehicleRepo([v]);
        service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);
        const created = await service.createReservation(conductorA, {
          vehicleId: v.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });
        expect(created.status).toBe('pending_approval');

        const res = await service.cancelReservation(conductorA, created.id);
        expect(res.status).toBe('cancelled');
        expect(res.refundCents).toBe(0);
        expect(res.balanceInCents).toBe(0);
      });
    });

    describe('cancelReservation con reembolso', () => {
      it('acredita 100% en flexible si cancela antes de 24h', async () => {
        const rentadorId = randomUUID();
        const ruleSetId = randomUUID();
        const ruleSet = makeRuleSet('FLEXIBLE', ruleSetId);
        const v = makeVehicle({
          ownerId: rentadorId,
          autoAccept: true,
          reservationRuleSetId: ruleSetId,
        });
        vehicleRepo = makeVehicleRepo([v]);
        reservationRuleSetRepo.findById.mockImplementation(async (id) =>
          id === ruleSetId ? ruleSet : null,
        );
        service = new ReservationService(repo, vehicleRepo, userRepo, reservationRuleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);

        clock.set(new Date('2026-06-08T09:00:00Z'));
        const created = await service.createReservation(conductorA, {
          vehicleId: v.getId(),
          startAt: '2026-06-10T10:00:00.000Z',
          endAt: '2026-06-12T10:00:00.000Z',
          contractAccepted: true,
        });
        await service.confirmPayment(conductorA, created.id, {
          paymentMethod: 'credit_card',
        });

        clock.set(new Date('2026-06-09T09:00:00Z'));
        const res = await service.cancelReservation(conductorA, created.id);

        expect(res.refundCents).toBe(48000);
        expect(res.balanceInCents).toBe(48000);
      });

      it('acredita 50% en moderada si cancela antes de 48h', async () => {
        const rentadorId = randomUUID();
        const ruleSetId = randomUUID();
        const ruleSet = makeRuleSet('MODERATE', ruleSetId);
        const v = makeVehicle({
          ownerId: rentadorId,
          autoAccept: true,
          reservationRuleSetId: ruleSetId,
        });
        vehicleRepo = makeVehicleRepo([v]);
        reservationRuleSetRepo.findById.mockImplementation(async (id) =>
          id === ruleSetId ? ruleSet : null,
        );
        service = new ReservationService(repo, vehicleRepo, userRepo, reservationRuleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);

        clock.set(new Date('2026-06-07T10:00:00Z'));
        const created = await service.createReservation(conductorA, {
          vehicleId: v.getId(),
          startAt: '2026-06-10T10:00:00.000Z',
          endAt: '2026-06-12T10:00:00.000Z',
          contractAccepted: true,
        });
        await service.confirmPayment(conductorA, created.id, {
          paymentMethod: 'credit_card',
        });

        clock.set(new Date('2026-06-08T10:00:00Z'));
        const res = await service.cancelReservation(conductorA, created.id);

        expect(res.refundCents).toBe(24000);
        expect(res.balanceInCents).toBe(24000);
      });

      it('acredita 100% en estricta dentro de 7 días y con más de 48h para iniciar', async () => {
        const rentadorId = randomUUID();
        const ruleSetId = randomUUID();
        const ruleSet = makeRuleSet('STRICT', ruleSetId);
        const v = makeVehicle({
          ownerId: rentadorId,
          autoAccept: true,
          reservationRuleSetId: ruleSetId,
        });
        vehicleRepo = makeVehicleRepo([v]);
        reservationRuleSetRepo.findById.mockImplementation(async (id) =>
          id === ruleSetId ? ruleSet : null,
        );
        service = new ReservationService(repo, vehicleRepo, userRepo, reservationRuleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);

        clock.set(new Date('2026-06-01T10:00:00Z'));
        const created = await service.createReservation(conductorA, {
          vehicleId: v.getId(),
          startAt: '2026-06-20T10:00:00.000Z',
          endAt: '2026-06-22T10:00:00.000Z',
          contractAccepted: true,
        });
        await service.confirmPayment(conductorA, created.id, {
          paymentMethod: 'credit_card',
        });

        clock.set(new Date('2026-06-05T10:00:00Z'));
        const res = await service.cancelReservation(conductorA, created.id);

        expect(res.refundCents).toBe(48000);
        expect(res.balanceInCents).toBe(48000);
      });

      it('no acredita reembolso en estricta si faltan 48h o menos para el inicio', async () => {
        const rentadorId = randomUUID();
        const ruleSetId = randomUUID();
        const ruleSet = makeRuleSet('STRICT', ruleSetId);
        const v = makeVehicle({
          ownerId: rentadorId,
          autoAccept: true,
          reservationRuleSetId: ruleSetId,
        });
        vehicleRepo = makeVehicleRepo([v]);
        reservationRuleSetRepo.findById.mockImplementation(async (id) =>
          id === ruleSetId ? ruleSet : null,
        );
        service = new ReservationService(repo, vehicleRepo, userRepo, reservationRuleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);

        clock.set(new Date('2026-06-01T10:00:00Z'));
        const created = await service.createReservation(conductorA, {
          vehicleId: v.getId(),
          startAt: '2026-06-07T10:00:00.000Z',
          endAt: '2026-06-09T10:00:00.000Z',
          contractAccepted: true,
        });
        await service.confirmPayment(conductorA, created.id, {
          paymentMethod: 'credit_card',
        });

        clock.set(new Date('2026-06-05T10:00:00Z'));
        const res = await service.cancelReservation(conductorA, created.id);

        expect(res.refundCents).toBe(0);
        expect(res.balanceInCents).toBe(0);
      });

      it('no acredita reembolso en estricta cuando ya pasaron 7 días desde paidAt', async () => {
        const rentadorId = randomUUID();
        const ruleSetId = randomUUID();
        const ruleSet = makeRuleSet('STRICT', ruleSetId);
        const v = makeVehicle({
          ownerId: rentadorId,
          autoAccept: true,
          reservationRuleSetId: ruleSetId,
        });
        vehicleRepo = makeVehicleRepo([v]);
        reservationRuleSetRepo.findById.mockImplementation(async (id) =>
          id === ruleSetId ? ruleSet : null,
        );
        service = new ReservationService(repo, vehicleRepo, userRepo, reservationRuleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);

        clock.set(new Date('2026-06-01T10:00:00Z'));
        const created = await service.createReservation(conductorA, {
          vehicleId: v.getId(),
          startAt: '2026-06-20T10:00:00.000Z',
          endAt: '2026-06-22T10:00:00.000Z',
          contractAccepted: true,
        });
        await service.confirmPayment(conductorA, created.id, {
          paymentMethod: 'credit_card',
        });

        clock.set(new Date('2026-06-09T10:00:00Z'));
        const res = await service.cancelReservation(conductorA, created.id);

        expect(res.refundCents).toBe(0);
        expect(res.balanceInCents).toBe(0);
      });

      it('usa fallback flexible cuando el vehículo no tiene rule set', async () => {
        const rentadorId = randomUUID();
        const v = makeVehicle({
          ownerId: rentadorId,
          autoAccept: true,
          reservationRuleSetId: null,
        });
        vehicleRepo = makeVehicleRepo([v]);
        service = new ReservationService(repo, vehicleRepo, userRepo, reservationRuleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);

        clock.set(new Date('2026-06-01T09:00:00Z'));
        const created = await service.createReservation(conductorA, {
          vehicleId: v.getId(),
          startAt: '2026-06-03T10:00:00.000Z',
          endAt: '2026-06-05T10:00:00.000Z',
          contractAccepted: true,
        });
        await service.confirmPayment(conductorA, created.id, {
          paymentMethod: 'credit_card',
        });

        clock.set(new Date('2026-06-02T09:00:00Z'));
        const res = await service.cancelReservation(conductorA, created.id);

        expect(res.refundCents).toBe(48000);
        expect(res.balanceInCents).toBe(48000);
      });
    });

    describe('expireOverdueReservations', () => {
      it('expira pending_approval con > 24h y libera el slot', async () => {
        const rentadorId = randomUUID();
        const v = makeVehicle({ ownerId: rentadorId, autoAccept: false });
        vehicleRepo = makeVehicleRepo([v]);
        service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);
        const created = await service.createReservation(conductorA, {
          vehicleId: v.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });

        clock.advanceMs(25 * 60 * 60 * 1000);
        const expired = await service.expireOverdueReservations();
        expect(expired).toBe(1);
        const after = await repo.findById(created.id);
        expect(after?.getStatus()).toBe('expired');
      });

      it('expira tanto holds de pago como solicitudes pending_approval en una corrida', async () => {
        const rentadorId = randomUUID();
        const autoV = makeVehicle({ ownerId: rentadorId, autoAccept: true });
        const manualV = makeVehicle({ ownerId: rentadorId, autoAccept: false });
        vehicleRepo = makeVehicleRepo([autoV, manualV]);
        service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);
        await service.createReservation(conductorA, {
          vehicleId: autoV.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });
        await service.createReservation(conductorB, {
          vehicleId: manualV.getId(),
          startAt: start,
          endAt: end,
          contractAccepted: true,
        });

        clock.advanceMs(25 * 60 * 60 * 1000);
        const expired = await service.expireOverdueReservations();
        expect(expired).toBe(2);
      });
    });
  });

  describe('Digital Voucher', () => {
    let rentadorId: string;
    let autoV: Vehicle;

    beforeEach(() => {
      rentadorId = randomUUID();
      autoV = makeVehicle({ ownerId: rentadorId, autoAccept: true });
      vehicleRepo = makeVehicleRepo([autoV]);
      service = new ReservationService(repo, vehicleRepo, userRepo, ruleSetRepo, clock, voucherProvider, notificationProvider, paymentGateway, emailProvider);    });

    it('returns a valid voucher when reservation is confirmed', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: autoV.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, created.id, {
        paymentMethod: 'credit_card',
      });

      const voucher = await service.getVoucher(created.id, conductorA);
      expect(voucher.reservationId).toBe(created.id);
      expect(voucher.status).toBe('confirmed');
      expect(voucher.paymentMethod).toBe('credit_card');
      expect(voucher.voucherToken).toBeDefined();
    });

    it('throws VoucherNotFoundException when reservation is pending_payment', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: autoV.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });

      await expect(service.getVoucher(created.id, conductorA)).rejects.toThrow(
        VoucherNotFoundException,
      );
    });

    it('throws VoucherReservationCancelledException when reservation is cancelled', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: autoV.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.cancelReservation(conductorA, created.id);

      await expect(service.getVoucher(created.id, conductorA)).rejects.toThrow(
        VoucherReservationCancelledException,
      );
    });

    it('throws ReservationForbiddenException when accessed by another conductor', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: autoV.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, created.id, {
        paymentMethod: 'credit_card',
      });

      await expect(service.getVoucher(created.id, conductorB)).rejects.toThrow(
        ReservationForbiddenException,
      );
    });

    it('verifies a valid voucher token successfully', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: autoV.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      const paymentRes = await service.confirmPayment(conductorA, created.id, {
        paymentMethod: 'credit_card',
      });

      const verification = await service.verifyVoucher(paymentRes.voucherToken);
      expect(verification.reservationId).toBe(created.id);
      expect(verification.status).toBe('confirmed');
      expect(verification.isValid).toBe(true);
    });

    it('verifies a voucher is invalid if reservation is cancelled', async () => {
      const created = await service.createReservation(conductorA, {
        vehicleId: autoV.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      const paymentRes = await service.confirmPayment(conductorA, created.id, {
        paymentMethod: 'credit_card',
      });

      // Force cancellation via new entity and repo (simulate cancellation)
      const resEntity = new Reservation({
        id: created.id,
        vehicleId: autoV.getId(),
        conductorId: conductorA,
        rentadorId: rentadorId,
        status: 'cancelled',
        startAt: new Date(start),
        endAt: new Date(end),
        holdExpiresAt: null,
        contractAcceptedAt: clock.now(),
        totalCents: 48000,
        paymentMethod: 'credit_card',
        paidAt: clock.now(),
        voucherToken: paymentRes.voucherToken,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });
      await repo.update(resEntity);

      const verification = await service.verifyVoucher(paymentRes.voucherToken);
      expect(verification.isValid).toBe(false);
      expect(verification.status).toBe('cancelled');
    });

    it('throws VoucherNotFoundException for unknown token', async () => {
      await expect(service.verifyVoucher(randomUUID())).rejects.toThrow(
        VoucherNotFoundException,
      );
    });
  });

  describe('confirmPickup', () => {
    async function makeConfirmedReservation() {
      const r = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, r.id, { paymentMethod: 'credit_card' });
      return r.id;
    }

    it('transitions confirmed to in_progress and returns returnQrToken + startedAt', async () => {
      const id = await makeConfirmedReservation();
      const saved = await repo.findById(id);
      const result = await service.confirmPickup(vehicle.getOwnerId(), saved!.getVoucherToken()!);
      expect(result.status).toBe('in_progress');
      expect(result.startedAt).toBeDefined();
      expect(result.returnQrToken).toBeDefined();
    });

    it('throws InvalidQrTokenException for unknown voucherToken', async () => {
      await expect(
        service.confirmPickup(vehicle.getOwnerId(), randomUUID()),
      ).rejects.toThrow(InvalidQrTokenException);
    });

    it('throws InvalidQrTokenException when reservation is not confirmed', async () => {
      const id = await makeConfirmedReservation();
      const saved = await repo.findById(id);
      const voucherToken = saved!.getVoucherToken()!;
      await service.confirmPickup(vehicle.getOwnerId(), voucherToken);
      await expect(
        service.confirmPickup(vehicle.getOwnerId(), voucherToken),
      ).rejects.toThrow(InvalidQrTokenException);
    });

    it('throws ReservationForbiddenException when called by wrong rentador', async () => {
      const id = await makeConfirmedReservation();
      const saved = await repo.findById(id);
      await expect(
        service.confirmPickup(randomUUID(), saved!.getVoucherToken()!),
      ).rejects.toThrow(ReservationForbiddenException);
    });
  });

  describe('confirmReturn', () => {
    async function makeInProgressReservation() {
      const r = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, r.id, { paymentMethod: 'credit_card' });
      const saved = await repo.findById(r.id);
      await service.confirmPickup(vehicle.getOwnerId(), saved!.getVoucherToken()!);
      return r.id;
    }

    it('transitions in_progress to completed and returns completedAt', async () => {
      const id = await makeInProgressReservation();
      const saved = await repo.findById(id);
      const result = await service.confirmReturn(conductorA, saved!.getReturnQrToken()!);
      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
    });

    it('throws InvalidQrTokenException for unknown returnQrToken', async () => {
      await expect(
        service.confirmReturn(conductorA, randomUUID()),
      ).rejects.toThrow(InvalidQrTokenException);
    });

    it('throws ReservationForbiddenException when called by wrong conductor', async () => {
      const id = await makeInProgressReservation();
      const saved = await repo.findById(id);
      await expect(
        service.confirmReturn(randomUUID(), saved!.getReturnQrToken()!),
      ).rejects.toThrow(ReservationForbiddenException);
    });
  });

  describe('extendReservation', () => {
    async function makeInProgressFor(
      ownerVehicle: Vehicle,
      payment: 'credit_card' | 'debit_card' = 'credit_card',
    ): Promise<string> {
      const r = await service.createReservation(conductorA, {
        vehicleId: ownerVehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, r.id, { paymentMethod: payment });
      const saved = await repo.findById(r.id);
      await service.confirmPickup(ownerVehicle.getOwnerId(), saved!.getVoucherToken()!);
      return r.id;
    }

    it('auto-accept ON crea extensión en pending_payment con hold de 10min', async () => {
      const id = await makeInProgressFor(vehicle);
      const result = await service.extendReservation(conductorA, id, {
        newEndAt: '2026-06-05T10:00:00.000Z',
      });
      expect(result.requiresApproval).toBe(false);
      expect(result.parentReservationId).toBe(id);
      const child = await repo.findById(result.id);
      expect(child?.getParentReservationId()).toBe(id);
      expect(child?.getStartAt().toISOString()).toBe(end);
      expect(child?.getEndAt().toISOString()).toBe('2026-06-05T10:00:00.000Z');
    });

    it('auto-accept OFF entra como pending_approval con hold de 24h', async () => {
      const manualVehicle = makeVehicle({ autoAccept: false });
      vehicleRepo = makeVehicleRepo([manualVehicle]);
      service = new ReservationService(
        repo,
        vehicleRepo,
        userRepo,
        ruleSetRepo,
        clock,
        voucherProvider,
        notificationProvider,
        paymentGateway,
        emailProvider,
        identityService,
        driverLicenseService,
      );
      const id = await makeInProgressFor(manualVehicle);
      const result = await service.extendReservation(conductorA, id, {
        newEndAt: '2026-06-05T10:00:00.000Z',
      });
      expect(result.requiresApproval).toBe(true);
      expect(result.status).toBe('pending_approval');
      const child = await repo.findById(result.id);
      expect(child?.getStatus()).toBe('pending_approval');
    });

    it('max nights del set actual fuerza modo solicitud aunque auto-accept esté ON', async () => {
      const ruleSetId = randomUUID();
      const ruleSetEntity = await import('@/domain/entities/reservation-rule-set.entity');
      const set = new ruleSetEntity.ReservationRuleSet(
        vehicle.getOwnerId(),
        null,
        'Max3',
        null,
        'FLEXIBLE',
        null,
        { type: 'UNLIMITED' },
        { minDays: 1, maxDays: 3 },
        0,
        new Date(),
        new Date(),
        ruleSetId,
      );
      await ruleSetRepo.save(set);
      vehicle.update({ reservationRuleSetId: ruleSetId });

      const id = await makeInProgressFor(vehicle);
      const result = await service.extendReservation(conductorA, id, {
        newEndAt: '2026-06-06T10:00:00.000Z',
      });
      expect(result.requiresApproval).toBe(true);
      expect(result.status).toBe('pending_approval');
    });

    it('rechaza cuando la reserva padre no está in_progress', async () => {
      const r = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, r.id, { paymentMethod: 'credit_card' });
      await expect(
        service.extendReservation(conductorA, r.id, {
          newEndAt: '2026-06-05T10:00:00.000Z',
        }),
      ).rejects.toThrow(ExtensionParentNotInProgressException);
    });

    it('rechaza newEndAt menor o igual al endAt actual del chain', async () => {
      const id = await makeInProgressFor(vehicle);
      await expect(
        service.extendReservation(conductorA, id, { newEndAt: end }),
      ).rejects.toThrow(ExtensionInvalidEndAtException);
    });

    it('rechaza cuando hay otra reserva confirmada solapando el rango pedido', async () => {
      const id = await makeInProgressFor(vehicle);
      await service.createReservation(conductorB, {
        vehicleId: vehicle.getId(),
        startAt: '2026-06-05T10:00:00.000Z',
        endAt: '2026-06-07T10:00:00.000Z',
        contractAccepted: true,
      });
      await expect(
        service.extendReservation(conductorA, id, {
          newEndAt: '2026-06-06T10:00:00.000Z',
        }),
      ).rejects.toThrow(VehicleNotAvailableException);
    });

    it('un conductor ajeno no puede extender', async () => {
      const id = await makeInProgressFor(vehicle);
      await expect(
        service.extendReservation(conductorB, id, {
          newEndAt: '2026-06-05T10:00:00.000Z',
        }),
      ).rejects.toThrow(ReservationForbiddenException);
    });

    it('cobro automático falla y deja la extensión en pending_payment', async () => {
      paymentGateway.processPayment.mockResolvedValueOnce({
        success: false,
        transactionId: 'failed',
      });
      const id = await makeInProgressFor(vehicle);
      const result = await service.extendReservation(conductorA, id, {
        newEndAt: '2026-06-05T10:00:00.000Z',
      });
      expect(result.requiresApproval).toBe(false);
      const child = await repo.findById(result.id);
      expect(child?.getStatus()).toBe('pending_payment');
      expect(child?.getHoldExpiresAt()).not.toBeNull();
    });

    async function setupManualInProgress(): Promise<string> {
      const manualVehicle = makeVehicle({ autoAccept: false });
      vehicleRepo = makeVehicleRepo([manualVehicle]);
      service = new ReservationService(
        repo,
        vehicleRepo,
        userRepo,
        ruleSetRepo,
        clock,
        voucherProvider,
        notificationProvider,
        paymentGateway,
        emailProvider,
        identityService,
        driverLicenseService,
      );
      return makeInProgressFor(manualVehicle);
    }

    it('bloquea una nueva extensión si ya hay una pendiente', async () => {
      const id = await setupManualInProgress();
      await service.extendReservation(conductorA, id, {
        newEndAt: '2026-06-05T10:00:00.000Z',
      });
      await expect(
        service.extendReservation(conductorA, id, {
          newEndAt: '2026-06-07T10:00:00.000Z',
        }),
      ).rejects.toThrow(PendingExtensionExistsException);
    });

    it('modifyExtension cambia la fecha y recalcula el total de la pendiente', async () => {
      const id = await setupManualInProgress();
      const ext = await service.extendReservation(conductorA, id, {
        newEndAt: '2026-06-05T10:00:00.000Z',
      });
      const beforeTotal = (await repo.findById(ext.id))!.getTotalCents();
      const result = await service.modifyExtension(conductorA, ext.id, {
        newEndAt: '2026-06-07T10:00:00.000Z',
      });
      expect(result.status).toBe('pending_approval');
      expect(result.totalCents).toBeGreaterThan(beforeTotal);
      const after = await repo.findById(ext.id);
      expect(after?.getEndAt().toISOString()).toBe('2026-06-07T10:00:00.000Z');
    });

    it('modifyExtension rechaza una reserva que no es extensión pendiente', async () => {
      const id = await makeInProgressFor(vehicle);
      await expect(
        service.modifyExtension(conductorA, id, {
          newEndAt: '2026-06-05T10:00:00.000Z',
        }),
      ).rejects.toThrow(ExtensionNotPendingException);
    });

    it('aprobar una extensión la auto-cobra con el medio de pago del padre', async () => {
      const manualVehicle = makeVehicle({ autoAccept: false });
      vehicleRepo = makeVehicleRepo([manualVehicle]);
      service = new ReservationService(
        repo,
        vehicleRepo,
        userRepo,
        ruleSetRepo,
        clock,
        voucherProvider,
        notificationProvider,
        paymentGateway,
        emailProvider,
        identityService,
        driverLicenseService,
      );
      const id = await makeInProgressFor(manualVehicle);
      const ext = await service.extendReservation(conductorA, id, {
        newEndAt: '2026-06-05T10:00:00.000Z',
      });
      expect(ext.requiresApproval).toBe(true);

      const result = await service.approve(manualVehicle.getOwnerId(), ext.id);
      expect(result.status).toBe('confirmed');
      const after = await repo.findById(ext.id);
      expect(after?.getStatus()).toBe('confirmed');
    });
  });

  describe('cancelReservation cascada por chain', () => {
    async function makeInProgressFor(ownerVehicle: Vehicle): Promise<string> {
      const r = await service.createReservation(conductorA, {
        vehicleId: ownerVehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, r.id, { paymentMethod: 'credit_card' });
      const saved = await repo.findById(r.id);
      await service.confirmPickup(ownerVehicle.getOwnerId(), saved!.getVoucherToken()!);
      return r.id;
    }

    it('cancela todos los eslabones del chain en una sola operación', async () => {
      const parentId = await makeInProgressFor(vehicle);
      const extension = await service.extendReservation(conductorA, parentId, {
        newEndAt: '2026-06-05T10:00:00.000Z',
      });
      await service.cancelReservation(conductorA, parentId);
      const parent = await repo.findById(parentId);
      const ext = await repo.findById(extension.id);
      expect(parent?.getStatus()).toBe('cancelled');
      expect(ext?.getStatus()).toBe('cancelled');
    });

    it('cancelar desde un eslabón hijo también cancela al padre', async () => {
      const parentId = await makeInProgressFor(vehicle);
      const extension = await service.extendReservation(conductorA, parentId, {
        newEndAt: '2026-06-05T10:00:00.000Z',
      });
      await service.cancelReservation(conductorA, extension.id);
      const parent = await repo.findById(parentId);
      expect(parent?.getStatus()).toBe('cancelled');
    });
  });

  describe('getById incluye chain', () => {
    it('expone los eslabones del chain ordenados cronológicamente', async () => {
      const r = await service.createReservation(conductorA, {
        vehicleId: vehicle.getId(),
        startAt: start,
        endAt: end,
        contractAccepted: true,
      });
      await service.confirmPayment(conductorA, r.id, { paymentMethod: 'credit_card' });
      const saved = await repo.findById(r.id);
      await service.confirmPickup(vehicle.getOwnerId(), saved!.getVoucherToken()!);
      const ext = await service.extendReservation(conductorA, r.id, {
        newEndAt: '2026-06-05T10:00:00.000Z',
      });

      const detail = await service.getById(conductorA, r.id);
      expect(detail.chain).toBeDefined();
      expect(detail.chain).toHaveLength(2);
      expect(detail.chain![0].id).toBe(r.id);
      expect(detail.chain![1].id).toBe(ext.id);
      expect(detail.chain![1].parentReservationId).toBe(r.id);
    });
  });
});

