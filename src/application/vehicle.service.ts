import { Vehicle } from '@/domain/entities/vehicle.entity';
import { EntityAlreadyExistsException, EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import type { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { Inject, Injectable } from '@nestjs/common';
import { 
    CreateVehicleRequest, 
    CreateVehicleResponse, 
    CreateVehicleResponseSchema, 
    GetVehicleResponse, 
    GetVehicleResponseSchema,
    UpdateVehicleRequest 
} from '@rocket-lease/contracts';

@Injectable()
export class VehicleService {
    constructor(
        @Inject(VEHICLE_REPOSITORY) 
        private readonly vehicleRepository: VehicleRepository
    ) {}

    public async createVehicle(ownerId: string, data: CreateVehicleRequest): Promise<CreateVehicleResponse> {
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
            data.photos,
            data.color,
            data.mileage,
            data.basePrice,
            data.description,
        );

        const savedVehicle = await this.vehicleRepository.save(vehicle);
        return CreateVehicleResponseSchema.parse({ id: savedVehicle.getId() });
    }

    public async getById(vehicleId: string): Promise<GetVehicleResponse> {
        const vehicle = await this.vehicleRepository.findById(vehicleId);
        if (!vehicle) throw new EntityNotFoundException('vehicle', vehicleId);
        return this.toDTO(vehicle);
    }

    public async updateVehicle(vehicleId: string, data: UpdateVehicleRequest): Promise<void> {
        const vehicle = await this.vehicleRepository.findById(vehicleId);
        if (!vehicle) throw new EntityNotFoundException('vehicle', vehicleId);
        vehicle.update(data);
        await this.vehicleRepository.save(vehicle);
    }

    public async getAll(): Promise<Array<GetVehicleResponse>> {
        const vehicles = await this.vehicleRepository.fetchAll();
        return vehicles.map(this.toDTO);
    }

    public async deleteVehicle(vehicleId: string): Promise<void> {
        const vehicle = await this.vehicleRepository.findById(vehicleId);
        if (!vehicle) throw new EntityNotFoundException('vehicle', vehicleId);
        await this.vehicleRepository.delete(vehicleId);
    }

    private toDTO(vehicle: Vehicle): GetVehicleResponse {
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
            photos: vehicle.getPhotos(),
            color: vehicle.getColor(),
            mileage: vehicle.getMileage(),
            basePrice: vehicle.getBasePrice(),
            description: vehicle.getDescription(),
        });
    }
}
