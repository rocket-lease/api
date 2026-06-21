import { Inject, Injectable } from '@nestjs/common';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepository,
  type VehicleFilter,
} from '@/domain/repositories/vehicle.repository';
import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '@/domain/repositories/reservation.repository';
import {
  FAVORITE_REPOSITORY,
  type FavoriteRepository,
} from '@/domain/repositories/favorite.repository';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import {
  RecommendationScorer,
  type VehicleForScoring,
  type ReservationHistoryItem,
  type UserPreferences,
} from '@/domain/services/recommendation-scorer';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { RESERVATION_STATUS } from '@/domain/entities/reservation.entity';
import {
  RecommendedVehiclesResponseSchema,
  SearchAlternativesResponseSchema,
  type RecommendedVehiclesResponse,
  type SearchAlternativesResponse,
} from '@rocket-lease/contracts';
import {
  PROMOTION_REPOSITORY,
  type PromotionRepository,
} from '@/domain/repositories/promotion.repository';
import { ZoneDemandPricer } from '@/application/pricing/zone-demand-pricer';
import { latLonToH3 } from '@/application/helpers/h3';
import { DYNAMIC_PRICING_NEUTRAL } from '@/application/pricing/config/dynamic-pricing.config';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';

@Injectable()
export class RecommendationService {
  private readonly scorer = new RecommendationScorer();

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: ReservationRepository,
    @Inject(FAVORITE_REPOSITORY)
    private readonly favoriteRepository: FavoriteRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PROMOTION_REPOSITORY)
    private readonly promotionRepository: PromotionRepository,
    @Inject(ZoneDemandPricer)
    private readonly zoneDemandPricer: ZoneDemandPricer,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  /**
   * Obtiene recomendaciones personalizadas para un conductor.
   * Si no hay historial de reservas, retorna sección vacía.
   */
  async getRecommendations(
    conductorId: string,
  ): Promise<RecommendedVehiclesResponse> {
    // 1. Obtener preferencias del usuario
    const userProfile = await this.userRepository.getProfileById(conductorId);
    const preferences: UserPreferences | null = userProfile?.preferences
      ? {
          transmission: userProfile.preferences.transmission ?? undefined,
          accessibility:
            userProfile.preferences.accessibility.length > 0
              ? userProfile.preferences.accessibility
              : undefined,
          maxPriceDailyCents:
            userProfile.preferences.maxPriceDaily ?? undefined,
        }
      : null;

    // 2. Obtener historial de reservas completadas
    const completedReservations = await this.reservationRepository.findByUser(
      conductorId,
      'conductor',
      {
        status: [RESERVATION_STATUS.completed],
        page: 1,
        pageSize: 100,
      },
    );

    // 3. Construir historial para el scorer (batch findByIds)
    const vehicleIds = completedReservations.items.map((r) =>
      r.getVehicleId(),
    );
    const vehicles = await this.vehicleRepository.findByIds(vehicleIds);
    const vehicleById = new Map(vehicles.map((v) => [v.getId(), v]));

    const history: ReservationHistoryItem[] = [];
    const previouslyRentedVehicleIds: string[] = [];

    for (const reservation of completedReservations.items) {
      const vehicle = vehicleById.get(reservation.getVehicleId());
      if (vehicle) {
        history.push({
          vehicleId: vehicle.getId(),
          brand: vehicle.getBrand(),
          transmission: vehicle.getTransmission(),
          province: vehicle.getProvince(),
          passengers: vehicle.getPassengers(),
          characteristics: vehicle.getCharacteristics(),
        });
        previouslyRentedVehicleIds.push(vehicle.getId());
      }
    }

    // Si no hay historial, retornar vacío
    if (history.length === 0) {
      return { section: '', vehicles: [] };
    }

    // 4. Obtener favoritos
    const favorites = await this.favoriteRepository.findByConductor(
      conductorId,
    );
    const favoriteVehicleIds = favorites.map((f) => f.vehicleId);

    // 5. Obtener vehículos disponibles
    const allVehicles = await this.vehicleRepository.findEnabledVehicles();

    // 6. Mapear a VehicleForScoring con promociones y demanda reales
    const availableVehicles = await this.mapToScoringVehicles(allVehicles);

    // 7. Calcular scoring
    const scored = this.scorer.score(
      {
        history,
        preferences,
        favoriteVehicleIds,
        availableVehicles,
        previouslyRentedVehicleIds,
      },
      10,
    );

    if (scored.length === 0) {
      return { section: '', vehicles: [] };
    }

    return RecommendedVehiclesResponseSchema.parse({
      section: 'Sugerido para vos',
      vehicles: scored.map((s) => s.vehicle),
    });
  }

  /**
   * Encuentra alternativas cercanas cuando una búsqueda no da resultados exactos.
   */
  async getSearchAlternatives(filters: {
    brand?: string;
    model?: string;
    year?: number;
    transmission?: string;
    maxPriceCents?: number;
    city?: string;
    province?: string;
    characteristics?: string[];
  }): Promise<SearchAlternativesResponse> {
    const exactFilter: VehicleFilter = {
      brand: filters.brand,
      model: filters.model,
      year: filters.year,
      transmission: filters.transmission,
      maxPriceCents: filters.maxPriceCents,
      city: filters.city,
    };
    const exactResults = await this.vehicleRepository.fetchAll(exactFilter);
    if (exactResults.length > 0) {
      return SearchAlternativesResponseSchema.parse({ alternatives: [], message: 'Ya existen resultados exactos para esta búsqueda' });
    }

    const allVehicles = await this.vehicleRepository.findEnabledVehicles();
    const availableVehicles = await this.mapToScoringVehicles(allVehicles);

    const alternatives = this.scorer.findNearAlternatives(
      availableVehicles,
      filters,
      5,
    );

    const mapped = alternatives.map((a) => ({
      vehicle: a.vehicle,
      differences: a.differences,
    }));

    if (mapped.length === 0) {
      return SearchAlternativesResponseSchema.parse({ alternatives: [], message: 'No hay alternativas cercanas disponibles' });
    }

    return SearchAlternativesResponseSchema.parse({ alternatives: mapped });
  }

  private async mapToScoringVehicles(
    vehicles: Vehicle[],
  ): Promise<VehicleForScoring[]> {
    const now = this.clock.now();
    const active = await this.promotionRepository.findAllActive();
    const promotedIds = new Set(
      active.filter((p) => !p.isExpired(now)).map((p) => p.vehicleId),
    );

    const cellByVehicle = new Map<string, string>();
    for (const vehicle of vehicles) {
      if (!vehicle.getDynamicPricingEnabled()) continue;
      const cell = latLonToH3(
        vehicle.getLatitude(),
        vehicle.getLongitude(),
      );
      if (cell) cellByVehicle.set(vehicle.getId(), cell);
    }
    const demandByVehicle = new Map<string, number>();
    if (cellByVehicle.size > 0) {
      const byCell = await this.zoneDemandPricer.multipliersForCells(
        new Set(cellByVehicle.values()),
      );
      for (const [vehicleId, cell] of cellByVehicle) {
        demandByVehicle.set(vehicleId, byCell.get(cell) ?? DYNAMIC_PRICING_NEUTRAL);
      }
    }

    return vehicles.map((vehicle) => ({
      id: vehicle.getId(),
      brand: vehicle.getBrand(),
      model: vehicle.getModel(),
      transmission: vehicle.getTransmission(),
      province: vehicle.getProvince(),
      city: vehicle.getCity(),
      passengers: vehicle.getPassengers(),
      isAccessible: vehicle.getIsAccessible(),
      basePriceCents: vehicle.getBasePriceCents(),
      characteristics: vehicle.getCharacteristics(),
      enabled: vehicle.isEnabled(),
      photos: vehicle.getPhotos(),
      year: vehicle.getYear(),
      mileage: vehicle.getMileage(),
      color: vehicle.getColor(),
      trunkLiters: vehicle.getTrunkLiters(),
      isPromoted: promotedIds.has(vehicle.getId()),
      autoAccept: vehicle.getAutoAccept(),
      demandMultiplier: demandByVehicle.get(vehicle.getId()) ?? DYNAMIC_PRICING_NEUTRAL,
    }));
  }
}
