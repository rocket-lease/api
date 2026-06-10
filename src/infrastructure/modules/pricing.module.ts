import { Module } from '@nestjs/common';
import { PricingController } from '@/infrastructure/controllers/pricing.controller';
import { PricingService } from '@/application/pricing/pricing.service';
import { DynamicPricingService } from '@/application/pricing/dynamic-pricing.service';
import { ZoneDemandPricer } from '@/application/pricing/zone-demand-pricer';
import { UtilizationFactor } from '@/application/pricing/factors/utilization.factor';
import { DemandZoneFactor } from '@/application/pricing/factors/demand-zone.factor';
import { PRICE_QUOTE_REPOSITORY } from '@/domain/repositories/price-quote.repository';
import { SEARCH_LOG_REPOSITORY } from '@/domain/repositories/search-log.repository';
import { PRICING_STATS_REPOSITORY } from '@/domain/repositories/pricing-stats.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { PostgresPriceQuoteRepository } from '@/infrastructure/repository/postgres.price-quote.repository';
import { PostgresSearchLogRepository } from '@/infrastructure/repository/postgres.search-log.repository';
import { PostgresPricingStatsRepository } from '@/infrastructure/repository/postgres.pricing-stats.repository';
import { PostgresVehicleRepository } from '@/infrastructure/repository/postgres.vehicle.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PricingController],
  providers: [
    PrismaService,
    PricingService,
    DynamicPricingService,
    ZoneDemandPricer,
    UtilizationFactor,
    DemandZoneFactor,
    {
      provide: VEHICLE_REPOSITORY,
      useClass: PostgresVehicleRepository,
    },
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
    ZoneDemandPricer,
    PRICE_QUOTE_REPOSITORY,
    SEARCH_LOG_REPOSITORY,
    PRICING_STATS_REPOSITORY,
  ],
})
export class PricingModule {}
