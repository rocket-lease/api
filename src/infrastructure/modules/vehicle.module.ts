import { Module } from '@nestjs/common';
import { VehicleController } from '@/infrastructure/controllers/vehicle.controller';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { VehicleService } from '@/application/vehicle.service';
import { PostgresVehicleRepository } from '../repository/postgres.vehicle.repository';
import { AuthModule } from './auth.module';
import { ReservationModule } from './reservation.module';

@Module({
  imports: [AuthModule, ReservationModule],
  controllers: [VehicleController],
  providers: [
    VehicleService,
    {
      provide: VEHICLE_REPOSITORY,
      useClass: PostgresVehicleRepository,
    },
  ],
  exports: [VehicleService],
})
export class VehicleModule {}
