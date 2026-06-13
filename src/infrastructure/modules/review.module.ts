import { Module } from '@nestjs/common';
import { ReviewController } from '@/infrastructure/controllers/review.controller';
import { REVIEW_REPOSITORY } from '@/domain/repositories/review.repository';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';
import { ReviewService } from '@/application/review.service';
import { PostgresReviewRepository } from '@/infrastructure/repository/postgres.review.repository';
import { PostgresReservationRepository } from '@/infrastructure/repository/postgres.reservation.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AuthModule } from './auth.module';
import { ReputationModule } from './reputation.module';
import { LoyaltyModule } from './loyalty.module';

@Module({
  imports: [AuthModule, ReputationModule, LoyaltyModule],
  controllers: [ReviewController],
  providers: [
    ReviewService,
    PrismaService,
    {
      provide: REVIEW_REPOSITORY,
      useClass: PostgresReviewRepository,
    },
    {
      provide: RESERVATION_REPOSITORY,
      useClass: PostgresReservationRepository,
    },
  ],
  exports: [ReviewService],
})
export class ReviewModule {}
