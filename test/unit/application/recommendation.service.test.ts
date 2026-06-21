import { Vehicle } from '@/domain/entities/vehicle.entity';
import { Reservation, RESERVATION_STATUS } from '@/domain/entities/reservation.entity';
import { Promotion } from '@/domain/entities/promotion/promotion.entity';
import { RecommendationService } from '@/application/recommendation.service';
import { DYNAMIC_PRICING_NEUTRAL } from '@/application/pricing/config/dynamic-pricing.config';
import { randomUUID } from 'crypto';

const OWNER_ID = randomUUID();
const CONDUCTOR_ID = randomUUID();
const NOW = new Date('2026-06-21T12:00:00Z');

function buildVehicle(overrides: Partial<{
  id: string;
  brand: string;
  model: string;
  transmission: 'Manual' | 'Automatico' | 'Semiautomatico';
  passengers: number;
  province: string;
  city: string;
  basePriceCents: number;
  characteristics: Array<'GPS' | 'BLUETOOTH' | 'WIFI' | 'SUNROOF'>;
  year: number;
  mileage: number;
  color: string;
  trunkLiters: number;
  enabled: boolean;
  latitude: number;
  longitude: number;
  dynamicPricingEnabled: boolean;
  photos: string[];
}> = {}): Vehicle {
  const opts = {
    id: randomUUID(),
    brand: 'Toyota',
    model: 'Corolla',
    transmission: 'Manual' as const,
    passengers: 5,
    province: 'B',
    city: 'CABA',
    basePriceCents: 50000,
    characteristics: ['GPS', 'BLUETOOTH'] as Array<'GPS' | 'BLUETOOTH'>,
    year: 2024,
    mileage: 10000,
    color: 'Rojo',
    trunkLiters: 400,
    enabled: true,
    latitude: -34.6,
    longitude: -58.4,
    dynamicPricingEnabled: false,
    photos: ['https://i.com/1.jpg'],
    ...overrides,
  };
  return new Vehicle(
    opts.id,
    OWNER_ID,
    'ABC-123',
    opts.brand,
    opts.model,
    opts.year,
    opts.passengers,
    opts.trunkLiters,
    opts.transmission,
    false,
    opts.enabled,
    opts.photos,
    opts.characteristics,
    opts.color,
    opts.mileage,
    opts.basePriceCents,
    [],
    null,
    opts.province,
    opts.city,
    '2026-01-01',
    null,
    null,
    null,
    opts.latitude,
    opts.longitude,
    false,
    false,
    null,
    false,
    null,
    0,
    opts.dynamicPricingEnabled,
  );
}

function buildReservation(vehicle: Vehicle): Reservation {
  return new Reservation({
    vehicleId: vehicle.getId(),
    conductorId: CONDUCTOR_ID,
    rentadorId: OWNER_ID,
    status: RESERVATION_STATUS.completed,
    startAt: new Date('2026-05-01'),
    endAt: new Date('2026-05-10'),
    holdExpiresAt: null,
    totalCents: 50000,
    contractAcceptedAt: new Date('2026-05-01'),
    basePriceCentsSnapshot: 50000,
    cancellationPolicySnapshot: 'FLEXIBLE',
    maxKilometrageSnapshot: { type: 'UNLIMITED' },
    rentalTimeConstraintsSnapshot: { minDays: 1, maxDays: 30 },
  });
}

function buildPromotion(vehicleId: string, startDate?: Date): Promotion {
  return {
    vehicleId,
    durationDays: 3,
    startDate: startDate ?? new Date('2026-06-01'),
    totalCents: 15000,
    status: 'active',
    paymentMethod: 'credit_card',
    paidAt: new Date(),
    transactionId: 'txn-1',
    transferCode: null,
    transferAlias: null,
    transferExpiresAt: null,
    createdAt: new Date(),
    isExpired: jest.fn().mockReturnValue(false),
  } as unknown as Promotion;
}

describe('RecommendationService', () => {
  let service: RecommendationService;
  let vehicleRepoMock: jest.Mocked<any>;
  let reservationRepoMock: jest.Mocked<any>;
  let favoriteRepoMock: jest.Mocked<any>;
  let userRepoMock: jest.Mocked<any>;
  let promotionRepoMock: jest.Mocked<any>;
  let zoneDemandPricerMock: jest.Mocked<any>;
  let clockMock: jest.Mocked<any>;

  beforeEach(() => {
    vehicleRepoMock = {
      save: jest.fn(),
      fetchAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      findByIds: jest.fn().mockResolvedValue([]),
      findByPlate: jest.fn().mockResolvedValue(null),
      findByOwnerId: jest.fn().mockResolvedValue([]),
      findByCharacteristics: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      bulkUpdatePrices: jest.fn(),
      countActiveReservationsByVehicleIds: jest.fn(),
      findEnabledVehicles: jest.fn().mockResolvedValue([]),
    };

    reservationRepoMock = {
      save: jest.fn(),
      findById: jest.fn(),
      findByUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findPendingByVehicle: jest.fn(),
      findPendingByOwner: jest.fn(),
      cancel: jest.fn(),
      cancelPendingByVehicle: jest.fn(),
      findChain: jest.fn(),
      hasActiveReservations: jest.fn(),
    };

    favoriteRepoMock = {
      save: jest.fn(),
      delete: jest.fn(),
      findByConductor: jest.fn().mockResolvedValue([]),
      findByConductorAndVehicle: jest.fn(),
      findByVehicle: jest.fn(),
    };

    userRepoMock = {
      save: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      getProfileById: jest.fn().mockResolvedValue(null),
      findProfilesByIds: jest.fn(),
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      updateBasicInfo: jest.fn(),
      creditBalance: jest.fn(),
      deleteById: jest.fn(),
      markPhoneVerified: jest.fn(),
      isPhoneVerified: jest.fn(),
      updateAutoAccept: jest.fn(),
      applyReputationPenalty: jest.fn(),
      updateLevel: jest.fn(),
    };

    promotionRepoMock = {
      findAllDurations: jest.fn(),
      findAllPercentages: jest.fn(),
      findAllActive: jest.fn().mockResolvedValue([]),
      findByVehicleId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    zoneDemandPricerMock = {
      multipliersForCells: jest.fn().mockResolvedValue(new Map()),
    };

    clockMock = {
      now: jest.fn().mockReturnValue(NOW),
    };

    service = new RecommendationService(
      vehicleRepoMock,
      reservationRepoMock,
      favoriteRepoMock,
      userRepoMock,
      promotionRepoMock,
      zoneDemandPricerMock,
      clockMock,
    );
  });

  describe('getRecommendations', () => {
    it('retorna sección vacía si el usuario no tiene perfil ni historial', async () => {
      userRepoMock.getProfileById.mockResolvedValue(null);
      reservationRepoMock.findByUser.mockResolvedValue({ items: [], total: 0 });

      const result = await service.getRecommendations(CONDUCTOR_ID);

      expect(result).toEqual({ section: '', vehicles: [] });
    });

    it('retorna sección vacía si el historial no tiene vehículos correspondientes', async () => {
      userRepoMock.getProfileById.mockResolvedValue({
        id: CONDUCTOR_ID,
        preferences: { transmission: null, accessibility: [], maxPriceDaily: null },
      } as any);
      const reservation = new Reservation({
        vehicleId: randomUUID(),
        conductorId: CONDUCTOR_ID,
        rentadorId: OWNER_ID,
        status: RESERVATION_STATUS.completed,
        startAt: new Date('2026-05-01'),
        endAt: new Date('2026-05-10'),
        holdExpiresAt: null,
        totalCents: 50000,
        contractAcceptedAt: new Date('2026-05-01'),
        basePriceCentsSnapshot: 50000,
        cancellationPolicySnapshot: 'FLEXIBLE',
        maxKilometrageSnapshot: { type: 'UNLIMITED' },
        rentalTimeConstraintsSnapshot: { minDays: 1, maxDays: 30 },
      });
      reservationRepoMock.findByUser.mockResolvedValue({ items: [reservation], total: 1 });
      vehicleRepoMock.findByIds.mockResolvedValue([]);

      const result = await service.getRecommendations(CONDUCTOR_ID);

      expect(result).toEqual({ section: '', vehicles: [] });
    });

    it('usa findByIds en vez de findById secuencial', async () => {
      const vehicle = buildVehicle();
      const reservation = buildReservation(vehicle);
      userRepoMock.getProfileById.mockResolvedValue({
        id: CONDUCTOR_ID,
        preferences: { transmission: null, accessibility: [], maxPriceDaily: null },
      } as any);
      reservationRepoMock.findByUser.mockResolvedValue({ items: [reservation], total: 1 });
      vehicleRepoMock.findByIds.mockResolvedValue([vehicle]);
      vehicleRepoMock.findEnabledVehicles.mockResolvedValue([]);

      await service.getRecommendations(CONDUCTOR_ID);

      expect(vehicleRepoMock.findByIds).toHaveBeenCalledWith([vehicle.getId()]);
      expect(vehicleRepoMock.findById).not.toHaveBeenCalled();
    });

    it('puntúa vehículos disponibles basado en historial', async () => {
      const toyota_id = randomUUID();
      const honda_id = randomUUID();
      const toyota = buildVehicle({ id: toyota_id, brand: 'Toyota' });
      const honda = buildVehicle({ id: honda_id, brand: 'Honda' });
      const reservation = buildReservation(toyota);

      userRepoMock.getProfileById.mockResolvedValue({
        id: CONDUCTOR_ID,
        name: 'Test',
        email: 'test@test.com',
        phone: '123456',
        avatarUrl: null,
        verificationStatus: 'verified',
        level: 'bronze',
        reputationScore: 0,
        balanceInCents: 0,
        preferences: { transmission: null, accessibility: [], maxPriceDaily: null },
        autoAccept: false,
        isAdmin: false,
      });
      reservationRepoMock.findByUser.mockResolvedValue({ items: [reservation], total: 1 });
      vehicleRepoMock.findByIds.mockResolvedValue([toyota]);
      vehicleRepoMock.findEnabledVehicles.mockResolvedValue([toyota, honda]);

      const result = await service.getRecommendations(CONDUCTOR_ID);

      expect(result.section).toBe('Sugerido para vos');
      expect(result.vehicles).toHaveLength(2);
      expect(result.vehicles[0].id).toBe(toyota_id);
    });

    it('incluye isPromoted = true cuando el vehículo tiene promoción activa', async () => {
      const vehicle = buildVehicle({ brand: 'Toyota', dynamicPricingEnabled: false });
      const reservation = buildReservation(vehicle);

      userRepoMock.getProfileById.mockResolvedValue({
        id: CONDUCTOR_ID,
        preferences: { transmission: null, accessibility: [], maxPriceDaily: null },
        autoAccept: false,
      } as any);
      reservationRepoMock.findByUser.mockResolvedValue({ items: [reservation], total: 1 });
      vehicleRepoMock.findByIds.mockResolvedValue([vehicle]);
      vehicleRepoMock.findEnabledVehicles.mockResolvedValue([vehicle]);

      const promotion = buildPromotion(vehicle.getId());
      promotionRepoMock.findAllActive.mockResolvedValue([promotion]);

      const result = await service.getRecommendations(CONDUCTOR_ID);

      const scored = result.vehicles.find((v: any) => v.id === vehicle.getId())!;
      expect(scored).toBeDefined();
      expect((scored as any).isPromoted).toBe(true);
    });

    it('usa ZoneDemandPricer cuando algún vehículo tiene dynamicPricingEnabled', async () => {
      const vehicle = buildVehicle({
        brand: 'Toyota',
        dynamicPricingEnabled: true,
        latitude: -34.6,
        longitude: -58.4,
      });
      const reservation = buildReservation(vehicle);

      userRepoMock.getProfileById.mockResolvedValue({
        id: CONDUCTOR_ID,
        preferences: { transmission: null, accessibility: [], maxPriceDaily: null },
        autoAccept: false,
      } as any);
      reservationRepoMock.findByUser.mockResolvedValue({ items: [reservation], total: 1 });
      vehicleRepoMock.findByIds.mockResolvedValue([vehicle]);
      vehicleRepoMock.findEnabledVehicles.mockResolvedValue([vehicle]);
      promotionRepoMock.findAllActive.mockResolvedValue([]);

      zoneDemandPricerMock.multipliersForCells.mockImplementation(
        async (cells: Set<string>) => {
          const result = new Map<string, number>();
          for (const cell of cells) result.set(cell, 1.5);
          return result;
        },
      );

      const result = await service.getRecommendations(CONDUCTOR_ID);

      const scored = result.vehicles.find((v: any) => v.id === vehicle.getId())!;
      expect(scored).toBeDefined();
      expect((scored as any).demandMultiplier).toBe(1.5);
      expect(zoneDemandPricerMock.multipliersForCells).toHaveBeenCalledTimes(1);
    });

    it('usa DYNAMIC_PRICING_NEUTRAL cuando no hay cell para el vehículo', async () => {
      const vehicle = buildVehicle({ brand: 'Toyota', dynamicPricingEnabled: false });
      const reservation = buildReservation(vehicle);

      userRepoMock.getProfileById.mockResolvedValue({
        id: CONDUCTOR_ID,
        preferences: { transmission: null, accessibility: [], maxPriceDaily: null },
        autoAccept: false,
      } as any);
      reservationRepoMock.findByUser.mockResolvedValue({ items: [reservation], total: 1 });
      vehicleRepoMock.findByIds.mockResolvedValue([vehicle]);
      vehicleRepoMock.findEnabledVehicles.mockResolvedValue([vehicle]);
      promotionRepoMock.findAllActive.mockResolvedValue([]);

      const result = await service.getRecommendations(CONDUCTOR_ID);

      const scored = result.vehicles.find((v: any) => v.id === vehicle.getId())!;
      expect((scored as any).demandMultiplier).toBe(DYNAMIC_PRICING_NEUTRAL);
    });

    it('no llama a ZoneDemandPricer si ningún vehículo tiene dynamicPricingEnabled', async () => {
      const vehicle = buildVehicle({ brand: 'Toyota', dynamicPricingEnabled: false });
      const reservation = buildReservation(vehicle);

      userRepoMock.getProfileById.mockResolvedValue({
        id: CONDUCTOR_ID,
        preferences: { transmission: null, accessibility: [], maxPriceDaily: null },
        autoAccept: false,
      } as any);
      reservationRepoMock.findByUser.mockResolvedValue({ items: [reservation], total: 1 });
      vehicleRepoMock.findByIds.mockResolvedValue([vehicle]);
      vehicleRepoMock.findEnabledVehicles.mockResolvedValue([vehicle]);
      promotionRepoMock.findAllActive.mockResolvedValue([]);

      await service.getRecommendations(CONDUCTOR_ID);

      expect(zoneDemandPricerMock.multipliersForCells).not.toHaveBeenCalled();
    });

    it('pasa validación de parse del schema', async () => {
      const vehicle = buildVehicle({ brand: 'Toyota' });
      const reservation = buildReservation(vehicle);

      userRepoMock.getProfileById.mockResolvedValue({
        id: CONDUCTOR_ID,
        preferences: { transmission: null, accessibility: [], maxPriceDaily: null },
        autoAccept: false,
      } as any);
      reservationRepoMock.findByUser.mockResolvedValue({ items: [reservation], total: 1 });
      vehicleRepoMock.findByIds.mockResolvedValue([vehicle]);
      vehicleRepoMock.findEnabledVehicles.mockResolvedValue([vehicle]);
      promotionRepoMock.findAllActive.mockResolvedValue([]);

      const result = await service.getRecommendations(CONDUCTOR_ID);
      expect(result).toHaveProperty('section');
      expect(result).toHaveProperty('vehicles');
      expect(Array.isArray(result.vehicles)).toBe(true);
    });
  });

  describe('getSearchAlternatives', () => {
    it('retorna mensaje cuando ya existen resultados exactos', async () => {
      const vehicle = buildVehicle({ brand: 'Toyota', model: 'Corolla' });
      vehicleRepoMock.fetchAll.mockResolvedValue([vehicle]);

      const result = await service.getSearchAlternatives({
        brand: 'Toyota',
        model: 'Corolla',
      });

      expect(result.alternatives).toEqual([]);
      expect(result.message).toBe('Ya existen resultados exactos para esta búsqueda');
    });

    it('retorna alternativas cuando no hay resultados exactos', async () => {
      const toyota = buildVehicle({ brand: 'Toyota', model: 'Corolla' });
      const honda = buildVehicle({ brand: 'Honda', model: 'Civic' });

      vehicleRepoMock.fetchAll.mockResolvedValue([]);
      vehicleRepoMock.findEnabledVehicles.mockResolvedValue([toyota, honda]);
      promotionRepoMock.findAllActive.mockResolvedValue([]);

      const result = await service.getSearchAlternatives({
        brand: 'Toyota',
        model: 'Corolla',
      });

      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it('retorna mensaje de no alternativas cuando no hay vehículos disponibles', async () => {
      vehicleRepoMock.fetchAll.mockResolvedValue([]);
      vehicleRepoMock.findEnabledVehicles.mockResolvedValue([]);
      promotionRepoMock.findAllActive.mockResolvedValue([]);

      const result = await service.getSearchAlternatives({
        brand: 'Toyota',
        model: 'Corolla',
      });

      expect(result.alternatives).toEqual([]);
      expect(result.message).toBe('No hay alternativas cercanas disponibles');
    });

    it('incluye differences en cada alternativa', async () => {
      const toyota = buildVehicle({ brand: 'Toyota', transmission: 'Automatico' });

      vehicleRepoMock.fetchAll.mockResolvedValue([]);
      vehicleRepoMock.findEnabledVehicles.mockResolvedValue([toyota]);
      promotionRepoMock.findAllActive.mockResolvedValue([]);

      const result = await service.getSearchAlternatives({
        brand: 'Toyota',
        transmission: 'Manual',
      });

      expect(result.alternatives.length).toBeGreaterThan(0);
      expect(result.alternatives[0].differences.length).toBeGreaterThan(0);
    });
  });
});
