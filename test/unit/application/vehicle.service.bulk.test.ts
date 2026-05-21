import { Vehicle } from '@/domain/entities/vehicle.entity';
import { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import { UserRepository } from '@/domain/repositories/user.repository';
import { VehicleService } from '@/application/vehicle.service';
import { ReservationRuleSetService } from '@/application/reservation-rule-set.service';
import { ReservationService } from '@/application/reservation.service';
import {
  BulkPriceUpdateResponse,
} from '@rocket-lease/contracts';
import { randomUUID } from 'crypto';

const OWNER_ID = randomUUID();
const OTHER_OWNER_ID = randomUUID();

const buildVehicle = (
  overrides: Partial<{ id: string; ownerId: string; basePriceCents: number }> = {},
) =>
  new Vehicle(
    overrides.id ?? randomUUID(),
    overrides.ownerId ?? OWNER_ID,
    'ABC-123',
    'Toyota',
    'Corolla',
    2020,
    5,
    400,
    'Manual',
    false,
    true,
    ['https://example.com/photo.jpg'],
    [],
    'Blue',
    100,
    overrides.basePriceCents ?? 5000,
    null,
    'Buenos Aires',
    'La Plata',
    '2025-01-01',
  );

describe('VehicleService — bulk price operations', () => {
  let service: VehicleService;
  let repositoryMock: jest.Mocked<VehicleRepository>;
  let userRepoMock: jest.Mocked<UserRepository>;

  beforeEach(() => {
    repositoryMock = {
      save: jest.fn(),
      fetchAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      findByIds: jest.fn().mockResolvedValue([]),
      findByPlate: jest.fn().mockResolvedValue(null),
      findByOwnerId: jest.fn().mockResolvedValue([]),
      findByCharacteristics: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      bulkUpdatePrices: jest.fn(),
      countActiveReservationsByVehicleIds: jest.fn(),
    };

    userRepoMock = {
      save: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      getProfileById: jest.fn().mockResolvedValue(null),
      findProfilesByIds: jest.fn().mockResolvedValue([]),
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      updateBasicInfo: jest.fn(),
      deleteById: jest.fn(),
      markPhoneVerified: jest.fn(),
      isPhoneVerified: jest.fn().mockResolvedValue(false),
      updateAutoAccept: jest.fn(),
    };

    const reservationServiceMock = {
      cancelPendingByVehicle: jest.fn().mockResolvedValue(0),
    } as unknown as ReservationService;

    const reservationRuleSetServiceMock = {
      getRuleSetDetails: jest.fn().mockResolvedValue(null),
    } as unknown as ReservationRuleSetService;

    service = new VehicleService(
      repositoryMock,
      userRepoMock,
      reservationServiceMock,
      reservationRuleSetServiceMock,
    );
  });

  describe('bulkUpdatePrices', () => {
    it('delega SET a repositorio y devuelve respuesta', async () => {
      const id1 = randomUUID();
      const id2 = randomUUID();
      const id3 = randomUUID();
      const vehicleIds = [id1, id2, id3];

      const expectedResponse: BulkPriceUpdateResponse = {
        updated: vehicleIds.map((id) => ({
          id,
          previousPriceCents: 5000,
          newPriceCents: 10000,
        })),
      };

      repositoryMock.bulkUpdatePrices.mockResolvedValue(expectedResponse);

      const result = await service.bulkUpdatePrices(OWNER_ID, {
        vehicleIds,
        operation: { type: 'SET', valueCents: 10000 },
      });

      expect(repositoryMock.bulkUpdatePrices).toHaveBeenCalledWith(
        vehicleIds,
        { type: 'SET', valueCents: 10000 },
        OWNER_ID,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('delega PERCENTAGE a repositorio con el delta correcto', async () => {
      const id1 = randomUUID();
      const vehicleIds = [id1];

      const expectedResponse: BulkPriceUpdateResponse = {
        updated: [{ id: id1, previousPriceCents: 5000, newPriceCents: 5750 }],
      };

      repositoryMock.bulkUpdatePrices.mockResolvedValue(expectedResponse);

      const result = await service.bulkUpdatePrices(OWNER_ID, {
        vehicleIds,
        operation: { type: 'PERCENTAGE', delta: 15 },
      });

      expect(repositoryMock.bulkUpdatePrices).toHaveBeenCalledWith(
        vehicleIds,
        { type: 'PERCENTAGE', delta: 15 },
        OWNER_ID,
      );
      expect(result.updated[0]?.newPriceCents).toBe(5750);
    });

    it('propaga excepción del repositorio cuando hay vehículo no disponible', async () => {
      const vehicleIds = [randomUUID()];
      repositoryMock.bulkUpdatePrices.mockRejectedValue(new Error('unavailable'));

      await expect(
        service.bulkUpdatePrices(OWNER_ID, {
          vehicleIds,
          operation: { type: 'SET', valueCents: 10000 },
        }),
      ).rejects.toThrow();
    });

    it('propaga excepción del repositorio cuando precio resultante sería inválido', async () => {
      const vehicleIds = [randomUUID()];
      repositoryMock.bulkUpdatePrices.mockRejectedValue(new Error('price invalid'));

      await expect(
        service.bulkUpdatePrices(OWNER_ID, {
          vehicleIds,
          operation: { type: 'PERCENTAGE', delta: -100 },
        }),
      ).rejects.toThrow();
    });
  });

  describe('getActiveReservationsCount', () => {
    it('retorna conteos cuando el repo valida ownership y devuelve counts', async () => {
      const id1 = randomUUID();
      const id2 = randomUUID();
      const vehicleIds = [id1, id2];

      repositoryMock.countActiveReservationsByVehicleIds.mockResolvedValue({
        [id1]: 3,
        [id2]: 0,
      });

      const result = await service.getActiveReservationsCount(OWNER_ID, vehicleIds);

      expect(repositoryMock.countActiveReservationsByVehicleIds).toHaveBeenCalledWith(vehicleIds, OWNER_ID);
      expect(result.counts[id1]).toBe(3);
      expect(result.counts[id2]).toBe(0);
    });

    it('propaga excepción del repo cuando el ownership check falla', async () => {
      const vehicleIds = [randomUUID(), randomUUID()];

      repositoryMock.countActiveReservationsByVehicleIds.mockRejectedValue(
        new Error('one or more vehicles do not belong to the current owner'),
      );

      await expect(
        service.getActiveReservationsCount(OWNER_ID, vehicleIds),
      ).rejects.toThrow('one or more vehicles do not belong to the current owner');
    });
  });
});
