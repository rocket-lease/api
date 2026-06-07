import { Inject, Injectable } from '@nestjs/common';
import {
  PRICING_STATS_REPOSITORY,
  type PricingStatsRepository,
} from '@/domain/repositories/pricing-stats.repository';
import {
  SEARCH_LOG_REPOSITORY,
  type SearchLogRepository,
} from '@/domain/repositories/search-log.repository';
import {
  PRICE_QUOTE_REPOSITORY,
  type PriceQuoteRepository,
} from '@/domain/repositories/price-quote.repository';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { DEMAND_ZONE_FACTOR } from '../config/dynamic-pricing.config';
import { computeWeightedDemand } from '../demand-weight';
import { latLonToH3 } from '@/application/helpers/h3';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Factor de demanda zonal: mide la presión sobre el hex H3 del vehículo
 * sumando las cuatro señales ponderadas del funnel (search ×1, vehicleView
 * ×5, quote ×20, reservation ×50) y comparándolas contra el inventario
 * disponible en el hex. Cada señal se lee de su tabla canónica:
 * `search`/`vehicleView` de `search_logs`, `quote` de `price_quotes`,
 * `reservation` de `reservations`. La ponderación la hace
 * `computeWeightedDemand`, compartida con el admin map.
 */
@Injectable()
export class DemandZoneFactor {
  constructor(
    @Inject(PRICING_STATS_REPOSITORY)
    private readonly stats: PricingStatsRepository,
    @Inject(SEARCH_LOG_REPOSITORY)
    private readonly searchLogRepository: SearchLogRepository,
    @Inject(PRICE_QUOTE_REPOSITORY)
    private readonly priceQuoteRepository: PriceQuoteRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  /**
   * Computa el factor de demanda zonal para un vehículo a partir de su
   * lat/lng. Si las coordenadas son nulas o no hay oferta en el hex,
   * devuelve el valor neutro.
   */
  public async compute(
    latitude: number | null,
    longitude: number | null,
  ): Promise<number> {
    const h3Cell = latLonToH3(latitude, longitude);
    if (!h3Cell) return DEMAND_ZONE_FACTOR.neutral;
    const since = new Date(
      this.clock.now().getTime() - DEMAND_ZONE_FACTOR.demandWindowDays * DAY_MS,
    );
    const [signals, quotes, reservations, supply] = await Promise.all([
      this.searchLogRepository.countSignalsInHexSince(h3Cell, since),
      this.priceQuoteRepository.countByHexSince(h3Cell, since),
      this.stats.countConfirmedInHexSince(h3Cell, since),
      this.stats.countAvailableInHex(h3Cell),
    ]);
    if (supply === 0) return DEMAND_ZONE_FACTOR.neutral;
    const demand = computeWeightedDemand({
      search: signals.search,
      vehicleView: signals.vehicleView,
      quote: quotes,
      reservation: reservations,
    });
    const ratio = demand / supply;
    const thresholds = DEMAND_ZONE_FACTOR.ratioThresholds;
    if (ratio > thresholds.veryHigh.ratio) return thresholds.veryHigh.multiplier;
    if (ratio > thresholds.high.ratio) return thresholds.high.multiplier;
    if (ratio < thresholds.low.ratio) return thresholds.low.multiplier;
    return DEMAND_ZONE_FACTOR.neutral;
  }
}
