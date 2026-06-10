import { Module } from '@nestjs/common';
import { AdminPricingController } from '@/infrastructure/controllers/admin-pricing.controller';
import { DebugPricingController } from '@/infrastructure/controllers/debug-pricing.controller';
import { AdminPricingService } from '@/application/admin/admin-pricing.service';
import { DebugPricingService } from '@/application/admin/debug-pricing.service';
import { AdminGuard } from '@/infrastructure/auth/admin.guard';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { PRICING_STATS_REPOSITORY } from '@/domain/repositories/pricing-stats.repository';
import { SEARCH_LOG_REPOSITORY } from '@/domain/repositories/search-log.repository';
import { PRICE_QUOTE_REPOSITORY } from '@/domain/repositories/price-quote.repository';
import { PostgresUserRepository } from '@/infrastructure/repository/postgres.user.repository';
import { PostgresPricingStatsRepository } from '@/infrastructure/repository/postgres.pricing-stats.repository';
import { PostgresSearchLogRepository } from '@/infrastructure/repository/postgres.search-log.repository';
import { PostgresPriceQuoteRepository } from '@/infrastructure/repository/postgres.price-quote.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdminPricingController, DebugPricingController],
  providers: [
    PrismaService,
    AdminPricingService,
    DebugPricingService,
    AdminGuard,
    {
      provide: USER_REPOSITORY,
      useClass: PostgresUserRepository,
    },
    {
      provide: PRICING_STATS_REPOSITORY,
      useClass: PostgresPricingStatsRepository,
    },
    {
      provide: SEARCH_LOG_REPOSITORY,
      useClass: PostgresSearchLogRepository,
    },
    {
      provide: PRICE_QUOTE_REPOSITORY,
      useClass: PostgresPriceQuoteRepository,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [AdminPricingService, AdminGuard],
})
export class AdminModule {}
