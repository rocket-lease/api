import { Module } from '@nestjs/common';
import { PricingController } from '@/infrastructure/controllers/pricing.controller';
import { PricingService } from '@/application/pricing/pricing.service';
import { DynamicPricingService } from '@/application/pricing/dynamic-pricing.service';
import { UtilizationFactor } from '@/application/pricing/factors/utilization.factor';
import { DemandZoneFactor } from '@/application/pricing/factors/demand-zone.factor';
import { LeadTimeFactor } from '@/application/pricing/factors/lead-time.factor';
import { WeekendFactor } from '@/application/pricing/factors/weekend.factor';
import { PRICE_QUOTE_REPOSITORY } from '@/domain/repositories/price-quote.repository';
import { SEARCH_LOG_REPOSITORY } from '@/domain/repositories/search-log.repository';
import { PRICING_STATS_REPOSITORY } from '@/domain/repositories/pricing-stats.repository';
import { PostgresPriceQuoteRepository } from '@/infrastructure/repository/postgres.price-quote.repository';
import { PostgresSearchLogRepository } from '@/infrastructure/repository/postgres.search-log.repository';
import { PostgresPricingStatsRepository } from '@/infrastructure/repository/postgres.pricing-stats.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import { VehicleModule } from './vehicle.module';

@Module({
  imports: [VehicleModule],
  controllers: [PricingController],
  providers: [
    PrismaService,
    PricingService,
    DynamicPricingService,
    UtilizationFactor,
    DemandZoneFactor,
    LeadTimeFactor,
    WeekendFactor,
    {
      provide: PRICE_QUOTE_REPOSITORY,
      useClass: PostgresPriceQuoteRepository,
    },
    {
      provide: SEARCH_LOG_REPOSITORY,
      useClass: PostgresSearchLogRepository,
    },
    {
      provide: PRICING_STATS_REPOSITORY,
      useClass: PostgresPricingStatsRepository,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [
    PricingService,
    DynamicPricingService,
    PRICE_QUOTE_REPOSITORY,
    SEARCH_LOG_REPOSITORY,
    PRICING_STATS_REPOSITORY,
  ],
})
export class PricingModule {}
