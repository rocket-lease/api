import { Vehicle } from '@/domain/entities/vehicle.entity';
import {
  EntityAlreadyExistsException,
  EntityNotFoundException,
  InvalidEntityDataException,
} from '@/domain/exceptions/domain.exception';
import type { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import type { UserProfile, UserRepository } from '@/domain/repositories/user.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { Inject, Injectable } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { UpdateVehicleRequestSchema } from '@rocket-lease/contracts';
import {
  CreateVehicleRequest,
  CreateVehicleResponse,
  CreateVehicleResponseSchema,
  Characteristic,
  GetVehicleResponse,
  GetVehicleResponseSchema,
  UpdateVehicleRequest,
  VehicleOwner,
} from '@rocket-lease/contracts';

@Injectable()
export class VehicleService {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly reservationService: ReservationService,
  ) {}

  public async createVehicle(
    ownerId: string,
    data: CreateVehicleRequest,
  ): Promise<CreateVehicleResponse> {
    const exists = await this.vehicleRepository.findByPlate(data.plate);
    if (exists) throw new EntityAlreadyExistsException('vehicle', data.plate);

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
      true,
      data.photos,
      data.characteristics || [],
      data.color,
      data.mileage,
      data.basePriceCents,
      data.description,
      data.province,
      data.city,
      data.availableFrom,
      data.autoAccept ?? null,
    );

    const savedVehicle = await this.vehicleRepository.save(vehicle);
    return CreateVehicleResponseSchema.parse({ id: savedVehicle.getId() });
  }

  public async getById(vehicleId: string): Promise<GetVehicleResponse> {
    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle) throw new EntityNotFoundException('vehicle', vehicleId);
    const owner = await this.loadOwner(vehicle.getOwnerId());
    return this.toDTO(vehicle, owner);
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
    try {
      const parsed = UpdateVehicleRequestSchema.parse(data);
      vehicle.update(parsed);
      await this.vehicleRepository.save(vehicle);
      if (wasEnabled && !vehicle.isEnabled()) {
        await this.reservationService.cancelPendingByVehicle(vehicle.getId());
      }
    } catch (e) {
      const field = e.issues?.[0]?.keys?.[0] ?? 'desconocido';
      throw new InvalidEntityDataException(`cannot modify field '${field}'`);
    }
  }

  public async getMyVehicles(
    ownerId: string,
  ): Promise<Array<GetVehicleResponse>> {
    const vehicles = await this.vehicleRepository.findByOwnerId(ownerId);
    return this.toListDTO(vehicles);
  }

  public async getPublishedByOwnerId(
    ownerId: string,
  ): Promise<Array<GetVehicleResponse>> {
    const vehicles = await this.vehicleRepository.findByOwnerId(ownerId);
    return this.toListDTO(vehicles.filter((v) => v.isEnabled()));
  }

  public async getAll(): Promise<Array<GetVehicleResponse>> {
    const vehicles = await this.vehicleRepository.fetchAll();
    return this.toListDTO(vehicles);
  }

  public async getByCharacteristics(
    characteristics: Characteristic[],
  ): Promise<Array<GetVehicleResponse>> {
    const vehicles =
      await this.vehicleRepository.findByCharacteristics(characteristics);
    return this.toListDTO(vehicles);
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

  private async loadOwner(ownerId: string): Promise<VehicleOwner | undefined> {
    const profile = await this.userRepository.getProfileById(ownerId);
    if (!profile) return undefined;
    return {
      id: profile.id,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      level: profile.level,
      reputationScore: profile.reputationScore,
      verified: profile.verificationStatus === 'verified',
    };
  }

  private async toListDTO(vehicles: Vehicle[]): Promise<GetVehicleResponse[]> {
    const ownerIds = Array.from(new Set(vehicles.map((v) => v.getOwnerId())));
    const profiles = await this.userRepository.findProfilesByIds(ownerIds);
    const owners = new Map<string, VehicleOwner>(
      profiles.map((p) => [p.id, this.profileToOwner(p)]),
    );
    return vehicles.map((v) => this.toDTO(v, owners.get(v.getOwnerId())));
  }

  private profileToOwner(profile: UserProfile): VehicleOwner {
    return {
      id: profile.id,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      level: profile.level,
      reputationScore: profile.reputationScore,
      verified: profile.verificationStatus === 'verified',
    };
  }

  private toDTO(vehicle: Vehicle, owner?: VehicleOwner): GetVehicleResponse {
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
      enabled: vehicle.isEnabled(),
      photos: vehicle.getPhotos(),
      characteristics: vehicle.getCharacteristics(),
      color: vehicle.getColor(),
      mileage: vehicle.getMileage(),
      basePriceCents: vehicle.getBasePriceCents(),
      description: vehicle.getDescription(),
      province: vehicle.getProvince(),
      city: vehicle.getCity(),
      availableFrom: vehicle.getAvailableFrom(),
      autoAccept: vehicle.getAutoAccept(),
      owner,
    });
  }
}
