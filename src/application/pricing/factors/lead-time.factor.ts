import { Injectable } from '@nestjs/common';
import { LEAD_TIME_FACTOR } from '../config/dynamic-pricing.config';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Factor de lead-time: reservas last-minute pagan más, reservas con mucha
 * antelación pagan menos. Modela la elasticidad temporal de la demanda.
 */
@Injectable()
export class LeadTimeFactor {
  /**
   * Computa el multiplier según los días entre `now` y `startAt`.
   */
  public compute(startAt: Date, now: Date = new Date()): number {
    const daysUntil = Math.floor((startAt.getTime() - now.getTime()) / DAY_MS);
    if (daysUntil <= LEAD_TIME_FACTOR.shortLeadDays) {
      return LEAD_TIME_FACTOR.shortLeadMultiplier;
    }
    if (daysUntil >= LEAD_TIME_FACTOR.longLeadDays) {
      return LEAD_TIME_FACTOR.longLeadMultiplier;
    }
    return LEAD_TIME_FACTOR.neutral;
  }
}
