import { Injectable } from '@nestjs/common';
import { WEEKEND_FACTOR } from '../config/dynamic-pricing.config';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Factor de fin de semana: si el rango de alquiler atraviesa sábado o
 * domingo, aplica un recargo plano. Captura la estacionalidad semanal sin
 * inflar el modelo con calendarios feriados.
 */
@Injectable()
export class WeekendFactor {
  /**
   * Devuelve el multiplier según si el rango `[startAt, endAt)` incluye al
   * menos un día sábado o domingo.
   */
  public compute(startAt: Date, endAt: Date): number {
    if (endAt.getTime() <= startAt.getTime()) return WEEKEND_FACTOR.neutral;
    const startMidnight = new Date(
      Date.UTC(
        startAt.getUTCFullYear(),
        startAt.getUTCMonth(),
        startAt.getUTCDate(),
      ),
    );
    const endMs = endAt.getTime();
    for (
      let cursor = startMidnight.getTime();
      cursor < endMs;
      cursor += DAY_MS
    ) {
      const dayOfWeek = new Date(cursor).getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return WEEKEND_FACTOR.withWeekendMultiplier;
      }
    }
    return WEEKEND_FACTOR.neutral;
  }
}
