import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationService } from '@/application/reservation.service';
import { LOGGER, type Logger } from '@/application/logger.interface';

@Injectable()
export class ReservationExpiryJob {
  @Inject(LOGGER) private readonly logger: Logger;

  constructor(@Inject(ReservationService) private readonly reservationService: ReservationService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiry(): Promise<void> {
    try {
      const expired = await this.reservationService.expireOverdueReservations();
      if (expired > 0) {
        this.logger.info(`Expired ${expired} overdue reservation(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to expire overdue reservations', e as Error);
    }

    try {
      const expiredTransfers =
        await this.reservationService.expireOverdueTransfers();
      if (expiredTransfers > 0) {
        this.logger.info(`Expired ${expiredTransfers} transfer(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to expire transfers', e as Error);
    }
  }

  /**
   * Método público para expirar solo transfers (usado en tests).
   */
  async expireTransfers(): Promise<number> {
    const count = await this.reservationService.expireOverdueTransfers();
    if (count > 0) {
      this.logger.info(`Expired ${count} transfer(s) via manual trigger`);
    }
    return count;
  }
}
