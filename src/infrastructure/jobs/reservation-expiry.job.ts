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

    // US-26: cancelar reservas señadas cuyo saldo no se pagó a tiempo.
    try {
      const expiredBalances =
        await this.reservationService.expireOverdueBalances();
      if (expiredBalances > 0) {
        this.logger.log(`Cancelled ${expiredBalances} overdue balance(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to expire overdue balances', e as Error);
    }
  }

  // US-30: recordatorio 24h antes del vencimiento del saldo. Idempotente.
  @Cron(CronExpression.EVERY_HOUR)
  async handleBalanceReminders(): Promise<void> {
    try {
      const reminded =
        await this.reservationService.sendUpcomingBalanceReminders();
      if (reminded > 0) {
        this.logger.log(`Sent ${reminded} balance reminder(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to send balance reminders', e as Error);
    }
  }

  @Cron('0 */5 * * * *')
  async handleOverdueInProgress(): Promise<void> {
    try {
      const notified = await this.reservationService.notifyOverdueInProgress();
      if (notified > 0) {
        this.logger.warn(`Notified ${notified} overdue in-progress reservation(s)`);
      }
    } catch (e) {
      this.logger.error('Failed to notify overdue in-progress reservations', e as Error);
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
