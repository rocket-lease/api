import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  SEARCH_LOG_REPOSITORY,
  type SearchLogRepository,
} from '@/domain/repositories/search-log.repository';
import {
  PRICE_QUOTE_REPOSITORY,
  type PriceQuoteRepository,
} from '@/domain/repositories/price-quote.repository';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const SEARCH_LOG_RETENTION_DAYS = 14;
const PRICE_QUOTE_GRACE_HOURS = 1;

/**
 * Job de mantenimiento que corre diariamente:
 *  - borra search logs con más de 14 días (retención).
 *  - borra price quotes cuyo `expires_at` ya pasó hace más de 1h (cleanup
 *    de la tabla, los expirados no se reusan pero ocupan espacio).
 */
@Injectable()
export class SearchLogCleanupJob {
  private readonly logger = new Logger(SearchLogCleanupJob.name);

  constructor(
    @Inject(SEARCH_LOG_REPOSITORY)
    private readonly searchLogRepository: SearchLogRepository,
    @Inject(PRICE_QUOTE_REPOSITORY)
    private readonly priceQuoteRepository: PriceQuoteRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  @Cron('0 4 * * *')
  public async handleCleanup(): Promise<void> {
    const now = this.clock.now();
    try {
      const cutoff = new Date(
        now.getTime() - SEARCH_LOG_RETENTION_DAYS * DAY_MS,
      );
      const deleted = await this.searchLogRepository.deleteOlderThan(cutoff);
      if (deleted > 0) {
        this.logger.log(`Cleaned up ${deleted} search log(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to clean up search logs', e as Error);
    }
    try {
      const quoteCutoff = new Date(
        now.getTime() - PRICE_QUOTE_GRACE_HOURS * HOUR_MS,
      );
      const deleted =
        await this.priceQuoteRepository.deleteExpiredBefore(quoteCutoff);
      if (deleted > 0) {
        this.logger.log(`Cleaned up ${deleted} expired price quote(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to clean up price quotes', e as Error);
    }
  }
}
