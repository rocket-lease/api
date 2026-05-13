import { Module } from '@nestjs/common';
import { VehicleController } from '@/infrastructure/controllers/vehicle.controller';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { VehicleService } from '@/application/vehicle.service';
import { PostgresVehicleRepository } from '../repository/postgres.vehicle.repository';
import { AuthModule } from './auth.module';

@Module({
    imports: [AuthModule],
    controllers: [VehicleController],
    providers: [
        VehicleService,
        {
            provide: VEHICLE_REPOSITORY,
            useClass: PostgresVehicleRepository,
        },
    ],
})
export class VehicleModule {}
