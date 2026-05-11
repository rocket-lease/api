import { Vehicle } from '@/domain/entities/vehicle.entity';
import { EntityAlreadyExistsException } from '@/domain/exceptions/domain.exception';
import type { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { Inject, Injectable } from '@nestjs/common';
import { CreateVehicleRequest, CreateVehicleResponse, CreateVehicleResponseSchema, GetVehicleResponse, GetVehicleResponseSchema } from '@rocket-lease/contracts';

@Injectable()
export class VehicleService {
    constructor(
        @Inject(VEHICLE_REPOSITORY) 
        private readonly vehicleRepository: VehicleRepository
    ) {}

    public async createVehicle(data: CreateVehicleRequest): Promise<CreateVehicleResponse> {
        const exists = await this.vehicleRepository.findByPlate(data.plate);
        if (exists) throw new EntityAlreadyExistsException('vehicle', data.plate);
        const vehicle = new Vehicle(
            undefined,
            data.plate,
            data.brand,
            data.model,
            data.color,
            data.mileage,
            data.basePrice,
            data.description,
        );
        return CreateVehicleResponseSchema.parse(await this.vehicleRepository.save(vehicle));
    }

    public async getAll(): Promise<Array<GetVehicleResponse>> {
        const vehicles = await this.vehicleRepository.fetchAll();
        return vehicles.map(vehicle => GetVehicleResponseSchema.parse(vehicle));
    }
}
