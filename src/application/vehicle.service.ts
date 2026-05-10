import { Vehicle } from '@/domain/entities/vehicle.entity';
import { EntityAlreadyExistsException } from '@/domain/exceptions/domain.exception';
import type { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class VehicleService {
  constructor(
    @Inject(VEHICLE_REPOSITORY) 
    private readonly vehicleRepository: VehicleRepository
  ) {}

  // TODO: Usar DTO
  public async createVehicle(data: any): Promise<void> {
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
    if (exists) throw new EntityAlreadyExistsException('vehicle', vehicle.getPlate());
    await this.vehicleRepository.save(vehicle);
  }

  // TODO: Usar DTO
  public async getAll(): Promise<Array<any>> {
      return await this.vehicleRepository.fetchAll();
  }
}
