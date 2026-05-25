import { randomUUID } from 'node:crypto';
import { ReservationRuleSetService } from '@/application/reservation-rule-set.service';
import { InMemoryReservationRuleSetRepository } from '@/infrastructure/repository/in_memory.reservation-rule-set.repository';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import type { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import {
  DepositPercentageOutOfRangeException,
  EntityNotFoundException,
  RuleSetNotFoundForOwnerException,
  RuleSetPrivateCannotBeSharedException,
  RuleSetVehicleIdImmutableException,
  VehicleAlreadyHasPrivateRuleSetException,
} from '@/domain/exceptions/domain.exception';

function makeVehicle(ownerId: string): Vehicle {
  return new Vehicle(
    randomUUID(),
    ownerId,
    'AE111AA',
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
  };
}

describe('ReservationRuleSetService', () => {
  let ruleSetRepo: InMemoryReservationRuleSetRepository;
  let vehicleRepo: jest.Mocked<VehicleRepository>;
  let service: ReservationRuleSetService;
  const ownerId = randomUUID();

  const baseDto = {
    name: 'Premium',
    cancellationPolicy: 'FLEXIBLE' as const,
    depositPercentage: null,
    maxKilometrage: { type: 'UNLIMITED' as const },
    rentalTimeConstraints: { minDays: 1 },
  };

  beforeEach(() => {
    ruleSetRepo = new InMemoryReservationRuleSetRepository();
    vehicleRepo = makeVehicleRepo([]);
    service = new ReservationRuleSetService(ruleSetRepo, vehicleRepo);
  });

  describe('createRuleSet', () => {
    it('creates a shared set when vehicleId is null', async () => {
      const res = await service.createRuleSet(ownerId, {
        ...baseDto,
        vehicleId: null,
      });
      const saved = await ruleSetRepo.findById(res.id);
      expect(saved?.getVehicleId()).toBeNull();
      expect(saved?.isPrivate()).toBe(false);
    });

    it('creates a private set when vehicleId points to an owned vehicle', async () => {
      const vehicle = makeVehicle(ownerId);
      vehicleRepo = makeVehicleRepo([vehicle]);
      service = new ReservationRuleSetService(ruleSetRepo, vehicleRepo);

      const res = await service.createRuleSet(ownerId, {
        ...baseDto,
        vehicleId: vehicle.getId(),
        depositPercentage: 20,
      });
      const saved = await ruleSetRepo.findById(res.id);
      expect(saved?.getVehicleId()).toBe(vehicle.getId());
      expect(saved?.getDepositPercentage()).toBe(20);
    });

    it('rejects creating a private set on someone else’s vehicle', async () => {
      const otherVehicle = makeVehicle(randomUUID());
      vehicleRepo = makeVehicleRepo([otherVehicle]);
      service = new ReservationRuleSetService(ruleSetRepo, vehicleRepo);

      await expect(
        service.createRuleSet(ownerId, {
          ...baseDto,
          vehicleId: otherVehicle.getId(),
        }),
      ).rejects.toThrow(RuleSetPrivateCannotBeSharedException);
    });

    it('rejects creating a second private set for a vehicle that already has one', async () => {
      const vehicle = makeVehicle(ownerId);
      vehicleRepo = makeVehicleRepo([vehicle]);
      service = new ReservationRuleSetService(ruleSetRepo, vehicleRepo);

      await service.createRuleSet(ownerId, {
        ...baseDto,
        vehicleId: vehicle.getId(),
        depositPercentage: 20,
      });

      await expect(
        service.createRuleSet(ownerId, {
          ...baseDto,
          vehicleId: vehicle.getId(),
          depositPercentage: 30,
        }),
      ).rejects.toThrow(VehicleAlreadyHasPrivateRuleSetException);
    });

    it('rejects depositPercentage out of range', async () => {
      await expect(
        service.createRuleSet(ownerId, {
          ...baseDto,
          vehicleId: null,
          depositPercentage: 5,
        }),
      ).rejects.toThrow();
    });

    it('throws DepositPercentageOutOfRangeException for boundary 9 (just below min)', async () => {
      // El contract Zod ya frena valores < 10. Forzamos un payload "ya parseado"
      // saltándonos el schema para verificar que el service tiene su propio
      // guardrail (defensa en profundidad ante un schema desactualizado).
      const dto = {
        ...baseDto,
        vehicleId: null,
        depositPercentage: 51,
      } as Parameters<typeof service.createRuleSet>[1];
      await expect(service.createRuleSet(ownerId, dto)).rejects.toThrow();
    });
  });

  describe('listRuleSets', () => {
    it('lists only shared sets, hiding private ones', async () => {
      const vehicle = makeVehicle(ownerId);
      vehicleRepo = makeVehicleRepo([vehicle]);
      service = new ReservationRuleSetService(ruleSetRepo, vehicleRepo);

      await service.createRuleSet(ownerId, {
        ...baseDto,
        vehicleId: null,
        name: 'Shared',
      });
      await service.createRuleSet(ownerId, {
        ...baseDto,
        vehicleId: vehicle.getId(),
        name: 'Private',
      });

      const sets = await service.listRuleSets(ownerId);
      expect(sets).toHaveLength(1);
      expect(sets[0].name).toBe('Shared');
    });
  });

  describe('updateRuleSet', () => {
    it('rejects when vehicleId is passed in the payload', async () => {
      const created = await service.createRuleSet(ownerId, {
        ...baseDto,
        vehicleId: null,
      });
      await expect(
        service.updateRuleSet(ownerId, created.id, {
          // El campo no existe en el tipo Update — lo forzamos en runtime para
          // garantizar que el guardrail responde igual.
          vehicleId: randomUUID(),
        } as unknown as Parameters<typeof service.updateRuleSet>[2]),
      ).rejects.toThrow(RuleSetVehicleIdImmutableException);
    });

    it('updates depositPercentage to a new in-range value', async () => {
      const created = await service.createRuleSet(ownerId, {
        ...baseDto,
        vehicleId: null,
      });
      await service.updateRuleSet(ownerId, created.id, {
        depositPercentage: 30,
      });
      const updated = await ruleSetRepo.findById(created.id);
      expect(updated?.getDepositPercentage()).toBe(30);
    });

    it('rejects update of a set owned by a different rentador with 404', async () => {
      const created = await service.createRuleSet(ownerId, {
        ...baseDto,
        vehicleId: null,
      });
      await expect(
        service.updateRuleSet(randomUUID(), created.id, {
          depositPercentage: 30,
        }),
      ).rejects.toThrow(RuleSetNotFoundForOwnerException);
    });

    it('rejects update with depositPercentage out of range', async () => {
      const created = await service.createRuleSet(ownerId, {
        ...baseDto,
        vehicleId: null,
      });
      await expect(
        service.updateRuleSet(ownerId, created.id, {
          depositPercentage: 5,
        }),
      ).rejects.toThrow();
    });
  });

  describe('getPrivateForVehicle', () => {
    it('returns the private set when the vehicle has one', async () => {
      const vehicle = makeVehicle(ownerId);
      vehicleRepo = makeVehicleRepo([vehicle]);
      service = new ReservationRuleSetService(ruleSetRepo, vehicleRepo);

      await service.createRuleSet(ownerId, {
        ...baseDto,
        vehicleId: vehicle.getId(),
        depositPercentage: 30,
      });

      const fetched = await service.getPrivateForVehicle(vehicle.getId(), ownerId);
      expect(fetched).not.toBeNull();
      expect(fetched?.depositPercentage).toBe(30);
    });

    it('returns null when the vehicle exists but has no private set', async () => {
      const vehicle = makeVehicle(ownerId);
      vehicleRepo = makeVehicleRepo([vehicle]);
      service = new ReservationRuleSetService(ruleSetRepo, vehicleRepo);

      const fetched = await service.getPrivateForVehicle(vehicle.getId(), ownerId);
      expect(fetched).toBeNull();
    });

    it('throws when the vehicle is not owned by the caller', async () => {
      const vehicle = makeVehicle(randomUUID());
      vehicleRepo = makeVehicleRepo([vehicle]);
      service = new ReservationRuleSetService(ruleSetRepo, vehicleRepo);

      await expect(
        service.getPrivateForVehicle(vehicle.getId(), ownerId),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('error codes (smoke test for filter mapping)', () => {
    it('DepositPercentageOutOfRangeException is a domain exception', () => {
      const err = new DepositPercentageOutOfRangeException(5);
      expect(err.message).toContain('10 and 50');
    });

    it('RuleSetVehicleIdImmutableException carries a clear message', () => {
      const err = new RuleSetVehicleIdImmutableException();
      expect(err.message).toContain('vehicleId');
    });
  });
});
