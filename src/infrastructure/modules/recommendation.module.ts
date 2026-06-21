import { Module } from '@nestjs/common';
import { RecommendationController } from '@/infrastructure/controllers/recommendation.controller';
import { RecommendationService } from '@/application/recommendation.service';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';
import { FAVORITE_REPOSITORY } from '@/domain/repositories/favorite.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { PROMOTION_REPOSITORY } from '@/domain/repositories/promotion.repository';
import { PostgresVehicleRepository } from '@/infrastructure/repository/postgres.vehicle.repository';
import { PostgresFavoriteRepository } from '@/infrastructure/repository/postgres.favorite.repository';
import { PostgresUserRepository } from '@/infrastructure/repository/postgres.user.repository';
import { PrismaPromotionRepository } from '@/infrastructure/repository/prisma.promotion.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AuthModule } from './auth.module';
import { CLOCK } from '@/domain/providers/clock.provider';
import { PostgresReservationRepository } from '@/infrastructure/repository/postgres.reservation.repository';
import { PricingModule } from './pricing.module';

@Module({
  imports: [AuthModule, PricingModule],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    PrismaService,
    {
      provide: VEHICLE_REPOSITORY,
      useClass: PostgresVehicleRepository,
    },
    {
      provide: RESERVATION_REPOSITORY,
      useClass: PostgresReservationRepository,
    },
    {
      provide: FAVORITE_REPOSITORY,
      useClass: PostgresFavoriteRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: PostgresUserRepository,
    },
    {
      provide: PROMOTION_REPOSITORY,
      useClass: PrismaPromotionRepository,
    },
    {
      provide: CLOCK,
      useFactory: () => ({ now: () => new Date() }),
    },
  ],
})
export class RecommendationModule {}
