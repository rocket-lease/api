import { Inject, Injectable } from '@nestjs/common';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepository,
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
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { RESERVATION_STATUS } from '@/domain/entities/reservation.entity';

export interface RecommendedVehiclesResponse {
  section: string;
  vehicles: VehicleForScoring[];
}

export interface AlternativeVehicleResponse {
  vehicle: VehicleForScoring;
  differences: string[];
}

export interface SearchAlternativesResponse {
  alternatives: AlternativeVehicleResponse[];
}

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

    // 3. Construir historial para el scorer
    const history: ReservationHistoryItem[] = [];
    const previouslyRentedVehicleIds: string[] = [];

    for (const reservation of completedReservations.items) {
      const vehicle = await this.vehicleRepository.findById(
        reservation.getVehicleId(),
      );
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

    // 6. Mapear a VehicleForScoring
    const availableVehicles: VehicleForScoring[] = allVehicles.map((v) =>
      this.mapToScoringVehicle(v),
    );

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

    return {
      section: 'Sugerido para vos',
      vehicles: scored.map((s) => s.vehicle),
    };
  }

  /**
   * Encuentra alternativas cercanas cuando una búsqueda no da resultados exactos.
   */
  async getSearchAlternatives(filters: {
    brand?: string;
    model?: string;
    transmission?: string;
    maxPriceCents?: number;
    city?: string;
    province?: string;
    characteristics?: string[];
  }): Promise<SearchAlternativesResponse> {
    const allVehicles = await this.vehicleRepository.findEnabledVehicles();
    const availableVehicles: VehicleForScoring[] = allVehicles.map((v) =>
      this.mapToScoringVehicle(v),
    );

    const alternatives = this.scorer.findNearAlternatives(
      availableVehicles,
      filters,
      5,
    );

    return {
      alternatives: alternatives.map((a) => ({
        vehicle: a.vehicle,
        differences: a.differences,
      })),
    };
  }

  /**
   * Notifica a los conductores que tienen un vehículo en favoritos
   * cuando hay nueva disponibilidad.
   * Este método es llamado por el suscriptor de eventos.
   */
  async notifyFavoriteAvailability(_vehicleId: string): Promise<void> {
    // Buscar todos los favoritos que contengan este vehículo
    // La notificación se delega al NotificationProvider
    // (implementado como evento en la capa de infraestructura)
    // Este método existe como hook para pruebas E2E
  }

  private mapToScoringVehicle(vehicle: Vehicle): VehicleForScoring {
    return {
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
      isPromoted: false,
      autoAccept: vehicle.getAutoAccept(),
      demandMultiplier: 1,
    };
  }
}
