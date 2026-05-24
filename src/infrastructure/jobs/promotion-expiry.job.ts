import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { PROMOTION_REPOSITORY, type PromotionRepository } from '@/domain/repositories/promotion.repository';

@Injectable()
export class PromotionExpiryJob {
  private readonly logger = new Logger(PromotionExpiryJob.name);

  constructor(
    @Inject(PROMOTION_REPOSITORY)
    private readonly promotionRepository: PromotionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiry(): Promise<void> {
    try {
      const expiredCount = await this.expirePromotions();
      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} promotion(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to expire promotions', e as Error);
    }
  }

  async expirePromotions(): Promise<number> {
    const now = this.clock.now();
    const active = await this.promotionRepository.findAllActive();
    let count = 0;
    for (const promotion of active) {
      if (promotion.isExpired(now)) {
        await this.promotionRepository.delete(promotion.vehicleId);
        count++;
      }
    }
    return count;
  }
}
