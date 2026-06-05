import { Inject, Injectable } from '@nestjs/common';
import {
  type AdminPricingZonesResponse,
  AdminPricingZonesResponseSchema,
} from '@rocket-lease/contracts';
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
import { h3CellToGeoJsonPolygon } from '@/application/helpers/h3';

/**
 * Service que arma el agregado de zonas (hex H3) que consume el admin map.
 * Cada hex incluye oferta (cantidad de vehículos), demanda (search logs +
 * reservas confirmadas ponderadas), ratio, multiplier promedio y un sample
 * de vehículos.
 */
@Injectable()
export class AdminPricingService {
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
   * Construye el snapshot completo del admin map agregando los signals
   * conocidos por hex H3 dentro de la ventana de demanda.
   */
  public async aggregateZones(): Promise<AdminPricingZonesResponse> {
    const now = this.clock.now();
    const since = new Date(
      now.getTime() -
        DEMAND_ZONE_FACTOR.demandWindowDays * 24 * 60 * 60 * 1000,
    );
    const [supplyZones, searchAggregates, quoteAggregates] = await Promise.all([
      this.stats.aggregateAdminZones(since),
      this.searchLogRepository.aggregateByH3Since(since),
      this.priceQuoteRepository.aggregateMultiplierByH3Since(since),
    ]);

    const supplyByCell = new Map(
      supplyZones.map((row) => [row.h3Cell, row]),
    );
    const searchByCell = new Map(
      searchAggregates.map((row) => [row.h3Cell, row.searches]),
    );
    const multiplierByCell = new Map(
      quoteAggregates.map((row) => [row.h3Cell, row]),
    );

    const allCells = new Set<string>([
      ...supplyByCell.keys(),
      ...searchByCell.keys(),
      ...multiplierByCell.keys(),
    ]);

    const zones = Array.from(allCells)
      .map((h3Cell) => {
        const supply = supplyByCell.get(h3Cell);
        const searches = searchByCell.get(h3Cell) ?? 0;
        const supplyCount = supply?.supplyCount ?? 0;
        const reservations = supply?.demandReservationCount ?? 0;
        const demandCount =
          searches + reservations * DEMAND_ZONE_FACTOR.reservationWeight;
        const ratio = supplyCount === 0 ? 0 : demandCount / supplyCount;
        const avgMultiplier =
          multiplierByCell.get(h3Cell)?.avgMultiplier ?? DYNAMIC_PRICING_NEUTRAL;
        return {
          h3Cell,
          geometry: h3CellToGeoJsonPolygon(h3Cell),
          supplyCount,
          demandCount,
          ratio,
          avgMultiplier,
          vehicleSampleIds: (supply?.vehicleSampleIds ?? []).slice(0, 10),
        };
      })
      .sort((left, right) => right.demandCount - left.demandCount);

    return AdminPricingZonesResponseSchema.parse({
      generatedAt: now.toISOString(),
      zones,
    });
  }
}
