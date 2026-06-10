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
import {
  DEMAND_ZONE_FACTOR,
  DYNAMIC_PRICING_NEUTRAL,
} from '@/application/pricing/config/dynamic-pricing.config';
import {
  computeWeightedDemand,
  demandMultiplierFromRatio,
  type DemandSignalCounts,
} from '@/application/pricing/demand-weight';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calcula el factor de demanda zonal (solo el componente de zona del pricing
 * dinámico, sin anticipación/finde/utilización) para un conjunto de celdas H3,
 * en una tanda. Sirve para mostrar un precio "desde" con la presión de demanda
 * ya reflejada antes de que el usuario elija fechas. Reusa las mismas
 * agregaciones por celda que alimentan el heatmap del admin, así el "desde" y
 * el multiplier real nunca divergen en su parte de demanda. Como el motor solo
 * infla, el factor se piso-clampea a la tarifa base (nunca descuenta).
 */
@Injectable()
export class ZoneDemandPricer {
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
   * Devuelve el multiplier de demanda zonal por celda para las celdas pedidas.
   * Las celdas sin presión (o sin oferta) quedan en el valor neutro.
   */
  public async multipliersForCells(
    cells: Iterable<string>,
  ): Promise<Map<string, number>> {
    const wanted = new Set(cells);
    const result = new Map<string, number>();
    if (wanted.size === 0) return result;

    const now = this.clock.now();
    const since = new Date(
      now.getTime() - DEMAND_ZONE_FACTOR.demandWindowDays * DAY_MS,
    );
    const [supplyZones, signalAggregates, quoteAggregates] = await Promise.all([
      this.stats.aggregateAdminZones(since),
      this.searchLogRepository.aggregateByH3AndSignalSince(since),
      this.priceQuoteRepository.aggregateMultiplierByH3Since(since),
    ]);

    const supplyByCell = new Map(supplyZones.map((row) => [row.h3Cell, row]));
    const countsByCell = new Map<string, DemandSignalCounts>();
    const countsFor = (cell: string): DemandSignalCounts => {
      let counts = countsByCell.get(cell);
      if (!counts) {
        counts = { search: 0, vehicleView: 0, quote: 0, reservation: 0 };
        countsByCell.set(cell, counts);
      }
      return counts;
    };
    for (const row of signalAggregates) {
      countsFor(row.h3Cell)[row.signal] += row.count;
    }
    for (const quote of quoteAggregates) {
      countsFor(quote.h3Cell).quote += quote.sampleSize;
    }
    for (const supply of supplyZones) {
      countsFor(supply.h3Cell).reservation += supply.demandReservationCount;
    }

    for (const cell of wanted) {
      const supplyCount = supplyByCell.get(cell)?.supplyCount ?? 0;
      const counts = countsByCell.get(cell);
      if (supplyCount === 0 || !counts) {
        result.set(cell, DYNAMIC_PRICING_NEUTRAL);
        continue;
      }
      const ratio = computeWeightedDemand(counts) / supplyCount;
      result.set(cell, demandMultiplierFromRatio(ratio));
    }
    return result;
  }
}
