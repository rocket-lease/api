import { Module } from '@nestjs/common';
import { VehicleController } from '@/infrastructure/controllers/vehicle.controller';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { PROMOTION_REPOSITORY } from '@/domain/repositories/promotion.repository';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import { VehicleService } from '@/application/vehicle.service';
import { PostgresVehicleRepository } from '../repository/postgres.vehicle.repository';
import { PrismaPromotionRepository } from '../repository/prisma.promotion.repository';
import { AuthModule } from './auth.module';
import { ReservationRuleSetModule } from './reservation-rule-set.module';
import { ReservationModule } from './reservation.module';
import { BankAccountModule } from './bank-account.module';

@Module({
  imports: [AuthModule, ReservationModule, ReservationRuleSetModule, BankAccountModule],
  controllers: [VehicleController],
  providers: [
    VehicleService,
    {
      provide: VEHICLE_REPOSITORY,
      useClass: PostgresVehicleRepository,
    },
    {
      provide: PROMOTION_REPOSITORY,
      useClass: PrismaPromotionRepository,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [VehicleService],
})
export class VehicleModule {}
