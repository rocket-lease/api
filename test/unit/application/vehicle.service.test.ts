import { Vehicle } from '@/domain/entities/vehicle.entity';
import { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import { UserRepository } from '@/domain/repositories/user.repository';
import { VehicleService } from '@/application/vehicle.service';
import { ReservationRuleSetService } from '@/application/reservation-rule-set.service';
import { ReservationService } from '@/application/reservation.service';
import { IdentityService } from '@/application/identity.service';
import { CreateVehicleResponseSchema } from '@rocket-lease/contracts';
import { randomUUID } from 'crypto';

const OWNER_ID = randomUUID();

const validDto = {
  plate: 'ABC-123',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2020,
  passengers: 5,
  trunkLiters: 400,
  transmission: 'Manual' as const,
  isAccessible: false,
  photos: ['https://example.com/photo.jpg'],
  color: 'Blue',
  mileage: 100,
  basePriceCents: 5000,
  description: null,
  province: 'Buenos Aires',
  city: 'La Plata',
  address: 'Calle 7 1234, La Plata',
  latitude: -34.9215,
  longitude: -57.9545,
  availableFrom: '2025-01-01',
  characteristics: ['GPS', 'BLUETOOTH'] as Array<'GPS' | 'BLUETOOTH'>,
};

const buildVehicle = (
  overrides: Partial<{ id: string; ownerId: string; enabled: boolean }> = {},
) =>
  new Vehicle(
    overrides.id ?? randomUUID(),
    overrides.ownerId ?? OWNER_ID,
    validDto.plate,
    validDto.brand,
    validDto.model,
    validDto.year,
    validDto.passengers,
    validDto.trunkLiters,
    validDto.transmission,
    validDto.isAccessible,
    overrides.enabled ?? true,
    validDto.photos,
    [...validDto.characteristics],
    validDto.color,
    validDto.mileage,
    validDto.basePriceCents,
    validDto.description,
    validDto.province,
    validDto.city,
    validDto.availableFrom,
  );

describe('VehicleService', () => {
  let service: VehicleService;
  let repositoryMock: jest.Mocked<VehicleRepository>;
  let userRepoMock: jest.Mocked<UserRepository>;
  let reservationRuleSetServiceMock: jest.Mocked<Pick<ReservationRuleSetService, 'getRuleSetDetails'>>;
  let identityServiceMock: jest.Mocked<Pick<IdentityService, 'assertVerified' | 'getSummaryByUserId' | 'getSummariesByUserIds'>>;

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
      creditBalance: jest.fn(),
      deleteById: jest.fn(),
      markPhoneVerified: jest.fn(),
      isPhoneVerified: jest.fn().mockResolvedValue(false),
      updateAutoAccept: jest.fn(),
    };
    reservationRuleSetServiceMock = {
      getRuleSetDetails: jest.fn().mockResolvedValue(null),
    };
    identityServiceMock = {
      assertVerified: jest.fn().mockResolvedValue(undefined),
      getSummaryByUserId: jest.fn().mockResolvedValue({
        status: 'verified',
        providerName: 'stub-identity-provider',
        providerRequestId: 'req-1',
        rejectionReason: null,
        submittedAt: '2026-05-25T12:00:00.000Z',
        reviewAfterAt: '2026-05-25T12:00:30.000Z',
        reviewedAt: '2026-05-25T12:00:30.000Z',
        verifiedAt: '2026-05-25T12:00:30.000Z',
      }),
      getSummariesByUserIds: jest.fn().mockResolvedValue(new Map()),
    };
    const reservationServiceMock = {
      cancelPendingByVehicle: jest.fn().mockResolvedValue(0),
    } as unknown as ReservationService;

    const promotionRepoMock = {
      findAllDurations: jest.fn(),
      findAllPercentages: jest.fn(),
      findAllActive: jest.fn().mockResolvedValue([]),
      findByVehicleId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const clockMock = { now: jest.fn().mockReturnValue(new Date()) };

    service = new VehicleService(
      repositoryMock,
      userRepoMock,
      promotionRepoMock,
      clockMock,
      reservationServiceMock,
      reservationRuleSetServiceMock as unknown as ReservationRuleSetService,
      identityServiceMock as unknown as IdentityService,
    );
  });

  it('should create a vehicle with characteristics', async () => {
    const expectedVehicle = buildVehicle();
    repositoryMock.save.mockResolvedValue(expectedVehicle);

    const response = await service.createVehicle(OWNER_ID, validDto);

    expect(repositoryMock.save).toHaveBeenCalledWith(expect.any(Vehicle));
    expect(response).toEqual({ id: expectedVehicle.getId() });
    expect(() => CreateVehicleResponseSchema.parse(response)).not.toThrow();
  });

  it('should throw when plate already exists', async () => {
    repositoryMock.findByPlate.mockResolvedValue(buildVehicle());

    await expect(service.createVehicle(OWNER_ID, validDto)).rejects.toThrow();
    expect(repositoryMock.save).not.toHaveBeenCalled();
  });

  it('should filter vehicles by characteristics', async () => {
    await service.getByCharacteristics(['GPS']);
    expect(repositoryMock.findByCharacteristics).toHaveBeenCalledWith(['GPS'], undefined);
  });

  it('should list only enabled vehicles when filtering by ownerId publicly', async () => {
    const enabledA = buildVehicle({ enabled: true });
    const enabledB = buildVehicle({ enabled: true });
    const disabled = buildVehicle({ enabled: false });
    repositoryMock.findByOwnerId.mockResolvedValue([
      enabledA,
      disabled,
      enabledB,
    ]);

    const result = await service.getPublishedByOwnerId(OWNER_ID);

    expect(repositoryMock.findByOwnerId).toHaveBeenCalledWith(OWNER_ID);
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.id)).toEqual([
      enabledA.getId(),
      enabledB.getId(),
    ]);
  });

  it('debería hacer exactamente 1 query de users para hidratar owners en el listado', async () => {
    const owner1 = randomUUID();
    const owner2 = randomUUID();
    const vehicles = [
      buildVehicle({ ownerId: owner1 }),
      buildVehicle({ ownerId: owner2 }),
      buildVehicle({ ownerId: owner1 }),
    ];
    repositoryMock.fetchAll.mockResolvedValue(vehicles);
    userRepoMock.findProfilesByIds.mockResolvedValue([]);

    await service.getAll();

    expect(userRepoMock.findProfilesByIds).toHaveBeenCalledTimes(1);
    expect(userRepoMock.findProfilesByIds).toHaveBeenCalledWith(
      expect.arrayContaining([owner1, owner2]),
    );
    expect(userRepoMock.getProfileById).not.toHaveBeenCalled();
  });

  it('should reject delete by non-owner', async () => {
    const vehicleId = randomUUID();
    const intruderId = randomUUID();
    repositoryMock.findById.mockResolvedValue(buildVehicle({ id: vehicleId }));

    await expect(
      service.deleteVehicle(vehicleId, intruderId),
    ).rejects.toThrow();
    expect(repositoryMock.delete).not.toHaveBeenCalled();
  });
});
