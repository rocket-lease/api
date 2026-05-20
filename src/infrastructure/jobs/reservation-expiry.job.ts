import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationService } from '@/application/reservation.service';

@Injectable()
export class ReservationExpiryJob {
  private readonly logger = new Logger(ReservationExpiryJob.name);

  constructor(@Inject(ReservationService) private readonly reservationService: ReservationService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiry(): Promise<void> {
    try {
      const expired = await this.reservationService.expireOverdueReservations();
      if (expired > 0) {
        this.logger.log(`Expired ${expired} overdue reservation(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to expire overdue reservations', e as Error);
    }

    try {
      const expiredTransfers =
        await this.reservationService.expireOverdueTransfers();
      if (expiredTransfers > 0) {
        this.logger.log(`Expired ${expiredTransfers} transfer(s)`);
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
      this.logger.log(`Expired ${count} transfer(s) via manual trigger`);
    }
    return count;
  }
}
