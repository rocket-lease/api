import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationService } from '@/application/reservation.service';

@Injectable()
export class ReservationExpiryJob {
  private readonly logger = new Logger(ReservationExpiryJob.name);

  constructor(private readonly reservationService: ReservationService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiry(): Promise<void> {
    try {
      const expired = await this.reservationService.expireOverdueHolds();
      if (expired > 0) {
        this.logger.log(`Expired ${expired} reservation hold(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to expire reservation holds', e as Error);
    }
  }
}
