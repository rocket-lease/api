import { Vehicle } from '@/domain/entities/vehicle.entity';
import {
  EntityAlreadyExistsException,
  EntityNotFoundException,
  InvalidEntityDataException,
} from '@/domain/exceptions/domain.exception';
import { VehicleLocationRequiredException } from '@/domain/exceptions/geo.exception';
import type { VehicleRepository, VehicleFilter } from '@/domain/repositories/vehicle.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import type { UserProfile, UserRepository } from '@/domain/repositories/user.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { ReservationService } from './reservation.service';
import { UpdateVehicleRequestSchema } from '@rocket-lease/contracts';
import {
  ActiveReservationsCountResponse,
  ActiveReservationsCountRequestSchema,
  BulkPriceUpdateRequest,
  BulkPriceUpdateRequestSchema,
  BulkPriceUpdateResponse,
  Characteristic,
  CreateVehicleRequest,
  CreateVehicleResponse,
  CreateVehicleResponseSchema,
  GetVehicleResponse,
  GetVehicleResponseSchema,
  UpdateVehicleRequest,
  VehicleOwner,
} from '@rocket-lease/contracts';
import { ReservationRuleSetService } from './reservation-rule-set.service';
import { PROMOTION_REPOSITORY, type PromotionRepository } from '@/domain/repositories/promotion.repository';
import { IdentityService } from '@/application/identity.service';
import {
  VEHICLE_DOCUMENT_REPOSITORY,
  type VehicleDocumentRepository,
} from '@/domain/repositories/vehicle-document.repository';
import { ZoneDemandPricer } from '@/application/pricing/zone-demand-pricer';
import { latLonToH3 } from '@/application/helpers/h3';
import { DYNAMIC_PRICING_NEUTRAL } from '@/application/pricing/config/dynamic-pricing.config';
import { FAVORITE_REPOSITORY, type FavoriteRepository } from '@/domain/repositories/favorite.repository';
import { NOTIFICATION_PROVIDER, type NotificationProvider } from '@/domain/providers/notification.provider';

@Injectable()
export class VehicleService {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PROMOTION_REPOSITORY)
    private readonly promotionRepository: PromotionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ReservationService) private readonly reservationService: ReservationService,
    @Inject(ReservationRuleSetService) private readonly reservationRuleSetService: ReservationRuleSetService,
    @Inject(IdentityService) private readonly identityService: IdentityService,
    @Inject(VEHICLE_DOCUMENT_REPOSITORY)
    private readonly vehicleDocumentRepository: VehicleDocumentRepository,
    @Inject(ZoneDemandPricer)
    private readonly zoneDemandPricer: ZoneDemandPricer,
    @Inject(FAVORITE_REPOSITORY)
    private readonly favoriteRepository: FavoriteRepository,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
  ) {}

  public async createVehicle(
    ownerId: string,
    data: CreateVehicleRequest,
  ): Promise<CreateVehicleResponse> {
    await this.identityService.assertVerified(ownerId);

    const exists = await this.vehicleRepository.findByPlate(data.plate);
    if (exists) throw new EntityAlreadyExistsException('vehicle', data.plate);

    if (
      data.latitude === undefined ||
      data.latitude === null ||
      data.longitude === undefined ||
      data.longitude === null ||
      !data.address
    ) {
      throw new VehicleLocationRequiredException();
    }

    const vehicle = new Vehicle(
      undefined,
      ownerId,
      data.plate,
      data.brand,
      data.model,
      data.year,
      data.passengers,
      data.trunkLiters,
      data.transmission,
      data.isAccessible,
      false,
      data.photos,
      data.characteristics || [],
      data.color,
      data.mileage,
      data.basePriceCents,
      data.discountTiers ?? [],
      data.description,
      data.province,
      data.city,
      data.availableFrom,
      null,
      data.autoAccept ?? null,
      data.address,
      data.latitude,
      data.longitude,
      false,
    );

    const savedVehicle = await this.vehicleRepository.save(vehicle);
    return CreateVehicleResponseSchema.parse({ id: savedVehicle.getId() });
  }

  public async getById(vehicleId: string): Promise<GetVehicleResponse> {
    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle) throw new EntityNotFoundException('vehicle', vehicleId);
    const owner = await this.loadOwner(
      vehicle.getOwnerId(),
      vehicle.getOwnerReputationScore(),
    );
    const demand = await this.demandMultipliersByVehicle([vehicle]);
    return this.toDTO(
      vehicle,
      owner,
      true,
      false,
      demand.get(vehicle.getId()) ?? DYNAMIC_PRICING_NEUTRAL,
    );
  }

  /**
   * Resuelve el factor de demanda zonal por vehículo (solo los que tienen
   * pricing dinámico activo) en una sola tanda, deduplicando por celda H3.
   */
  private async demandMultipliersByVehicle(
    vehicles: Vehicle[],
  ): Promise<Map<string, number>> {
    const cellByVehicle = new Map<string, string>();
    for (const vehicle of vehicles) {
      if (!vehicle.getDynamicPricingEnabled()) continue;
      const cell = latLonToH3(vehicle.getLatitude(), vehicle.getLongitude());
      if (cell) cellByVehicle.set(vehicle.getId(), cell);
    }
    const result = new Map<string, number>();
    if (cellByVehicle.size === 0) return result;
    const byCell = await this.zoneDemandPricer.multipliersForCells(
      new Set(cellByVehicle.values()),
    );
    for (const [vehicleId, cell] of cellByVehicle) {
      result.set(vehicleId, byCell.get(cell) ?? DYNAMIC_PRICING_NEUTRAL);
    }
    return result;
  }

  public async updateVehicle(
    vehicleId: string,
    ownerId: string,
    data: UpdateVehicleRequest,
  ): Promise<void> {
    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle) throw new EntityNotFoundException('vehicle', vehicleId);
    if (vehicle.getOwnerId() !== ownerId) {
      throw new EntityNotFoundException('vehicle', vehicleId);
    }
    const wasEnabled = vehicle.isEnabled();
    const prevAvailableFrom = vehicle.getAvailableFrom();
    try {
      const parsed = UpdateVehicleRequestSchema.parse(data);
      vehicle.update(parsed);
      await this.vehicleRepository.save(vehicle);
      if (wasEnabled && !vehicle.isEnabled()) {
        await this.reservationService.cancelPendingByVehicle(vehicle.getId());
      }
      const now = this.clock.now().toISOString().split('T')[0];
      const wasUnavailable = !!prevAvailableFrom && prevAvailableFrom > now;
      const isNowAvailable = !vehicle.getAvailableFrom() || vehicle.getAvailableFrom() <= now;
      if (wasUnavailable && isNowAvailable) {
        const favorites = await this.favoriteRepository.findByVehicle(vehicle.getId());
        await Promise.all(
          favorites.map((f) =>
            this.notificationProvider.notify(f.conductorId, '¡Vehiculo disponible!', `El ${vehicle.getBrand()} ${vehicle.getModel()} que guardaste ya está disponible.`, {
              url: `/vehiculos/${vehicle.getId()}`,
              tag: `fav-available-${vehicle.getId()}`,
              imageUrl: vehicle.getPhotos()[0],
            }),
          ),
        );
      }
    } catch (e: any) {
      const field = e?.issues?.[0]?.keys?.[0] ?? 'desconocido';
      throw new InvalidEntityDataException(`cannot modify field '${field}'`);
    }
  }

  public async getMyVehicles(
    ownerId: string,
  ): Promise<Array<GetVehicleResponse>> {
    const vehicles = await this.vehicleRepository.findByOwnerId(ownerId);
    return this.toListDTOWithPromotion(vehicles);
  }

  public async getPublishedByOwnerId(
    ownerId: string,
  ): Promise<Array<GetVehicleResponse>> {
    const vehicles = await this.vehicleRepository.findByOwnerId(ownerId);
    return this.toListDTO(vehicles.filter((v) => v.isEnabled()));
  }

  public async getAll(filter?: VehicleFilter): Promise<Array<GetVehicleResponse>> {
    const vehicles = await this.vehicleRepository.fetchAll(filter);
    return this.toListDTOWithPromotion(vehicles);
  }

  public async getByCharacteristics(
    characteristics: Characteristic[],
    filter?: VehicleFilter,
  ): Promise<Array<GetVehicleResponse>> {
    const vehicles =
      await this.vehicleRepository.findByCharacteristics(characteristics, filter);
    return this.toListDTOWithPromotion(vehicles);
  }

  public async getAllPromoted(filter?: VehicleFilter): Promise<Array<GetVehicleResponse>> {
    const vehicles = await this.vehicleRepository.fetchAll(filter);
    return this.toListDTOWithPromotion(vehicles);
  }

  public async deleteVehicle(
    vehicleId: string,
    ownerId: string,
  ): Promise<void> {
    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle) throw new EntityNotFoundException('vehicle', vehicleId);
    if (vehicle.getOwnerId() !== ownerId) {
      throw new EntityNotFoundException('vehicle', vehicleId);
    }
    await this.reservationService.cancelPendingByVehicle(vehicleId);
    await this.vehicleRepository.delete(vehicleId);
  }

  public async bulkUpdatePrices(
    ownerId: string,
    request: BulkPriceUpdateRequest,
  ): Promise<BulkPriceUpdateResponse> {
    const validated = BulkPriceUpdateRequestSchema.parse(request);
    return this.vehicleRepository.bulkUpdatePrices(validated.vehicleIds, validated.operation, ownerId);
  }

  /**
   * Devuelve el conteo de reservas en estado `confirmed` o `in_progress` por
   * cada vehículo. Usado por el preview del ajuste masivo de precios para
   * avisar al rentador cuántas reservas activas mantendrán el precio snapshot
   * y por ende no se verán afectadas por el cambio.
   *
   * Lanza `BulkPriceVehicleNotOwnedException` (403) si alguno de los vehículos
   * no pertenece al rentador autenticado.
   */
  public async getActiveReservationsCount(
    ownerId: string,
    vehicleIds: string[],
  ): Promise<ActiveReservationsCountResponse> {
    const { vehicleIds: validatedIds } = ActiveReservationsCountRequestSchema.parse({ vehicleIds });
    const counts = await this.vehicleRepository.countActiveReservationsByVehicleIds(validatedIds, ownerId);
    return { counts };
  }

  private async loadOwner(ownerId: string, score: number): Promise<VehicleOwner | undefined> {
    const profile = await this.userRepository.getProfileById(ownerId);
    if (!profile) return undefined;
    const identityVerification = await this.identityService.getSummaryByUserId(ownerId);
    return {
      id: profile.id,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      level: profile.level,
      reputationScore: score,
      verified: identityVerification.status === 'verified',
    };
  }

  private async toListDTO(vehicles: Vehicle[]): Promise<GetVehicleResponse[]> {
    const ownerIds = Array.from(new Set(vehicles.map((v) => v.getOwnerId())));
    const profiles = await this.userRepository.findProfilesByIds(ownerIds);
    const verifications = await this.identityService.getSummariesByUserIds(ownerIds);
    const owners = new Map<string, VehicleOwner>(
      profiles.map((p) => [p.id, this.profileToOwner(p, 0, verifications.get(p.id))]),
    );
    return Promise.all(vehicles.map((v) => {
      const owner = owners.get(v.getOwnerId());
      return this.toDTO(v, owner ? { ...owner, reputationScore: v.getOwnerReputationScore() } : undefined);
    }));
  }

  private async toListDTOWithPromotion(vehicles: Vehicle[]): Promise<GetVehicleResponse[]> {
    const now = this.clock.now();
    const active = await this.promotionRepository.findAllActive();
    const promotedIds = new Set(active.filter((p) => !p.isExpired(now)).map((p) => p.vehicleId));

    const ownerIds = Array.from(new Set(vehicles.map((v) => v.getOwnerId())));
    const profiles = await this.userRepository.findProfilesByIds(ownerIds);
    const verifications = await this.identityService.getSummariesByUserIds(ownerIds);
    const owners = new Map<string, VehicleOwner>(
      profiles.map((p) => [p.id, this.profileToOwner(p, 0, verifications.get(p.id))]),
    );
    const demand = await this.demandMultipliersByVehicle(vehicles);

    const sorted = [...vehicles].sort((a, b) => {
      const aPromoted = promotedIds.has(a.getId()) ? 1 : 0;
      const bPromoted = promotedIds.has(b.getId()) ? 1 : 0;
      if (aPromoted !== bPromoted) {
        return bPromoted - aPromoted;
      }
      return b.getOwnerReputationScore() - a.getOwnerReputationScore();
    });

    return Promise.all(
      sorted.map((v) => {
        const owner = owners.get(v.getOwnerId());
        return this.toDTO(
          v,
          owner
            ? { ...owner, reputationScore: v.getOwnerReputationScore() }
            : undefined,
          false,
          promotedIds.has(v.getId()),
          demand.get(v.getId()) ?? DYNAMIC_PRICING_NEUTRAL,
        );
      }),
    );
  }

  private profileToOwner(profile: UserProfile, score: number, identityVerification?: { status: string } ): VehicleOwner {
    return {
      id: profile.id,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      level: profile.level,
      reputationScore: score,
      verified: identityVerification?.status === 'verified',
    };
  }

  private async loadReservationRuleSet(vehicleId: string, ruleSetId: string | null) {
    const privateSet =
      await this.reservationRuleSetService.getPublicRuleSetForVehicle(vehicleId);
    if (privateSet) return privateSet;
    if (!ruleSetId) return null;
    return this.reservationRuleSetService.getPublicRuleSet(ruleSetId);
  }

  private async getDocumentStatus(vehicleId: string): Promise<'none' | 'pending' | 'verified' | 'rejected'> {
    const verification = await this.vehicleDocumentRepository.findByVehicleId(vehicleId);
    if (!verification) return 'none';
    return verification.getStatus();
  }

  private async toDTO(
    vehicle: Vehicle,
    owner?: VehicleOwner,
    includeReservationRuleSet = false,
    isPromoted = false,
    demandMultiplier = DYNAMIC_PRICING_NEUTRAL,
  ): Promise<GetVehicleResponse> {
    const reservationRuleSet = includeReservationRuleSet
      ? await this.loadReservationRuleSet(
          vehicle.getId(),
          vehicle.getReservationRuleSetId(),
        )
      : undefined;
    const documentStatus = await this.getDocumentStatus(vehicle.getId());
    return GetVehicleResponseSchema.parse({
      id: vehicle.getId(),
      ownerId: vehicle.getOwnerId(),
      plate: vehicle.getPlate(),
      brand: vehicle.getBrand(),
      model: vehicle.getModel(),
      year: vehicle.getYear(),
      passengers: vehicle.getPassengers(),
      trunkLiters: vehicle.getTrunkLiters(),
      transmission: vehicle.getTransmission(),
      isAccessible: vehicle.getIsAccessible(),
      isPromoted,
      enabled: vehicle.isEnabled(),
      photos: vehicle.getPhotos(),
      characteristics: vehicle.getCharacteristics(),
      color: vehicle.getColor(),
      mileage: vehicle.getMileage(),
      basePriceCents: vehicle.getBasePriceCents(),
      discountTiers: vehicle.getDiscountTiers(),
      description: vehicle.getDescription(),
      province: vehicle.getProvince(),
      city: vehicle.getCity(),
      address: vehicle.getAddress(),
      latitude: vehicle.getLatitude(),
      longitude: vehicle.getLongitude(),
      locationApproximate: vehicle.isLocationApproximate(),
      availableFrom: vehicle.getAvailableFrom(),
      reservationRuleSetId: vehicle.getReservationRuleSetId(),
      autoAccept: vehicle.getAutoAccept(),
      homeDeliveryEnabled: vehicle.getHomeDeliveryEnabled(),
      homeDeliveryFeeCents: vehicle.getHomeDeliveryFeeCents(),
      homeReturnEnabled: vehicle.getHomeReturnEnabled(),
      homeReturnFeeCents: vehicle.getHomeReturnFeeCents(),
      dynamicPricingEnabled: vehicle.getDynamicPricingEnabled(),
      demandMultiplier,
      reservationRuleSet: reservationRuleSet,
      owner,
      documentStatus,
    });
  }
}
