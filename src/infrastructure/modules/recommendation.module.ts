import { Module } from '@nestjs/common';
import { RecommendationController } from '@/infrastructure/controllers/recommendation.controller';
import { RecommendationService } from '@/application/recommendation.service';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';
import { FAVORITE_REPOSITORY } from '@/domain/repositories/favorite.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { PostgresVehicleRepository } from '@/infrastructure/repository/postgres.vehicle.repository';
import { PostgresFavoriteRepository } from '@/infrastructure/repository/postgres.favorite.repository';
import { PostgresUserRepository } from '@/infrastructure/repository/postgres.user.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AuthModule } from './auth.module';
import { CLOCK } from '@/domain/providers/clock.provider';
import { PostgresReservationRepository } from '@/infrastructure/repository/postgres.reservation.repository';

@Module({
  imports: [AuthModule],
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
      provide: CLOCK,
      useFactory: () => ({ now: () => new Date() }),
    },
  ],
})
export class RecommendationModule {}
