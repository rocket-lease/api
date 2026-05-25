import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import {
  PromotionPlansController,
  VehiclePromotionController,
} from '@/infrastructure/controllers/promotion.controller';
import { PromotionService } from '@/application/promotion.service';
import { PROMOTION_REPOSITORY } from '@/domain/repositories/promotion.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { PAYMENT_GATEWAY_PROVIDER } from '@/domain/providers/payment-gateway.provider';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import { PrismaPromotionRepository } from '../repository/prisma.promotion.repository';
import { PostgresVehicleRepository } from '../repository/postgres.vehicle.repository';
import { StubPaymentGatewayProvider } from '../providers/stub.payment-gateway.provider';
import { PromotionExpiryJob } from '../jobs/promotion-expiry.job';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule, ScheduleModule],
  controllers: [PromotionPlansController, VehiclePromotionController],
  providers: [
    PromotionService,
    PromotionExpiryJob,
    {
      provide: PROMOTION_REPOSITORY,
      useClass: PrismaPromotionRepository,
    },
    {
      provide: VEHICLE_REPOSITORY,
      useClass: PostgresVehicleRepository,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
    {
      provide: PAYMENT_GATEWAY_PROVIDER,
      useClass: StubPaymentGatewayProvider,
    },
  ],
  exports: [PromotionService],
})
export class PromotionModule {}
