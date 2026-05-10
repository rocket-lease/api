import { Module } from '@nestjs/common';
import { VehicleController } from '@/infrastructure/controllers/vehicle.controller';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { VehicleService } from '@/application/vehicle.service';
import { InMemoryVehicleRepository } from '../repository/inMemoryVehicle.repository';

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
