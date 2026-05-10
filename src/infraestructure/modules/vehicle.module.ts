import { Module } from '@nestjs/common';
import { VehicleController } from '@/infraestructure/controllers/vehicle.controller';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { VehicleService } from '@/application/vehicle.service';
import { InMemoryVehicleRepository } from '../repository/in_memory_vehicle.repository';

@Module({
  controllers: [VehicleController],
  providers: [
    VehicleService,
    {
      provide: VEHICLE_REPOSITORY,
      useClass: InMemoryVehicleRepository,
    },
  ],
})
export class VehicleModule {}
