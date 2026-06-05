import { Module } from '@nestjs/common';
import { SearchLogService } from '@/application/search-log.service';
import { SEARCH_LOG_REPOSITORY } from '@/domain/repositories/search-log.repository';
import { PRICE_QUOTE_REPOSITORY } from '@/domain/repositories/price-quote.repository';
import { PostgresSearchLogRepository } from '@/infrastructure/repository/postgres.search-log.repository';
import { PostgresPriceQuoteRepository } from '@/infrastructure/repository/postgres.price-quote.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import { SearchLogCleanupJob } from '@/infrastructure/jobs/search-log-cleanup.job';

@Module({
  providers: [
    PrismaService,
    SearchLogService,
    SearchLogCleanupJob,
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
  exports: [SearchLogService, SEARCH_LOG_REPOSITORY, PRICE_QUOTE_REPOSITORY],
})
export class SearchLogModule {}
