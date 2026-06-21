import { Inject, Injectable } from '@nestjs/common';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import {
  PRICING_STATS_REPOSITORY,
  type PricingStatsRepository,
} from '@/domain/repositories/pricing-stats.repository';
import { UTILIZATION_FACTOR } from '../config/dynamic-pricing.config';

/**
 * Factor de utilización individual del vehículo. Castiga vehículos con
 * agenda saturada (precio sube) y baja precio cuando hay mucha
 * disponibilidad libre. Vehículos sin historia suficiente devuelven 1.0
 * para no penalizar inventario nuevo.
 */
@Injectable()
export class UtilizationFactor {
  constructor(
    @Inject(PRICING_STATS_REPOSITORY)
    private readonly stats: PricingStatsRepository,
  ) {}

  /**
   * Computa el factor para un vehículo dado en función de su utilización
   * proyectada a `forecastWindowDays`. Si el vehículo es cold-start
   * (menos de `coldStartThreshold` reservas en `coldStartWindowDays`),
   * devuelve el valor neutro.
   */
  public async compute(vehicle: Vehicle): Promise<number> {
    const since = new Date(
      Date.now() - UTILIZATION_FACTOR.coldStartWindowDays * 24 * 60 * 60 * 1000,
    );
    const historical = await this.stats.countConfirmedReservationsSince(
      vehicle.getId(),
      since,
    );
    if (historical < UTILIZATION_FACTOR.coldStartThreshold) {
      return UTILIZATION_FACTOR.neutral;
    }
    const utilization = await this.stats.computeUtilizationForWindow(
      vehicle.getId(),
      UTILIZATION_FACTOR.forecastWindowDays,
    );
    const buckets = UTILIZATION_FACTOR.buckets;
    if (utilization > buckets.veryHigh.utilization) return buckets.veryHigh.multiplier;
    if (utilization > buckets.high.utilization) return buckets.high.multiplier;
    if (utilization > buckets.medium.utilization) return buckets.medium.multiplier;
    if (utilization < buckets.low.utilization) return buckets.low.multiplier;
    return UTILIZATION_FACTOR.neutral;
  }
}
