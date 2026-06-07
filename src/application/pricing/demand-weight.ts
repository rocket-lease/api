import { DEMAND_ZONE_FACTOR } from './config/dynamic-pricing.config';
import type { SearchSignal } from '@/domain/entities/search-log.entity';

export type DemandSignalCounts = Record<SearchSignal, number>;

/**
 * Pondera las cuatro señales de demanda con los pesos de
 * `DEMAND_ZONE_FACTOR.signalWeights`. Es la única fuente de verdad del
 * cálculo: la consumen tanto el factor de pricing en runtime
 * (`DemandZoneFactor`) como el agregador del admin map
 * (`AdminPricingService`), de modo que el multiplier que ve el conductor y
 * el heatmap que ve el admin nunca puedan divergir.
 *
 * Cada señal vive en su tabla canónica y el caller la junta antes de
 * ponderar: `search`/`vehicleView` en `search_logs`, `quote` en
 * `price_quotes`, `reservation` en `reservations`.
 */
export function computeWeightedDemand(counts: DemandSignalCounts): number {
  const weights = DEMAND_ZONE_FACTOR.signalWeights;
  return (
    counts.search * weights.search +
    counts.vehicleView * weights.vehicleView +
    counts.quote * weights.quote +
    counts.reservation * weights.reservation
  );
}
