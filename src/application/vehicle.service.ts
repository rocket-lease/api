import { Vehicle } from '@/domain/vehicle.entity';
import type { VehicleRepository } from '@/domain/vehicle.repository';
import { VEHICLE_REPOSITORY } from '@/domain/vehicle.repository';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class VehicleService {
  constructor(
    @Inject(VEHICLE_REPOSITORY) 
    private readonly vehicleRepository: VehicleRepository
  ) {}

  // TODO: Usar DTO
  public async publish_vehicle(data: any): Promise<void> {
      const vehicle = new Vehicle(
          data.plate,
          data.brand,
          data.model,
          data.color,
          data.mileage,
          data.basePrice,
          data.description,
      );

    const exists = await this.vehicleRepository.findByPlate(vehicle.getPlate());
    if (exists) throw new Error('El vehículo ya está registrado');

    await this.vehicleRepository.save(vehicle);
  }
}
