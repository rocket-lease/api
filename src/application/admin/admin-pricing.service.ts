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
import { DEMAND_ZONE_FACTOR } from '@/application/pricing/config/dynamic-pricing.config';
import {
  h3CellToGeoJsonPolygon,
  isH3CellInCaba,
} from '@/application/helpers/h3';
import {
  computeWeightedDemand,
  demandMultiplierFromRatio,
  type DemandSignalCounts,
} from '@/application/pricing/demand-weight';

/**
 * Service que arma el agregado de zonas (hex H3) que consume el admin map.
 * Cada hex incluye oferta (cantidad de vehículos), demanda ponderada (suma
 * de cuatro señales con pesos crecientes según intención: search ×1,
 * vehicleView ×5, quote ×20, reservation ×50), ratio, el factor de demanda
 * de la zona EN VIVO y un sample de vehículos. El `avgMultiplier` no es un
 * promedio de cotizaciones pasadas (eso laggea y mezcla fechas) sino el
 * factor de demanda actual derivado del ratio demanda/oferta, calculado con
 * los mismos cortes que el motor de pricing. Así el hex reacciona al instante
 * a la demanda y nunca muestra un número promediado arbitrario.
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
    const [supplyZones, signalAggregates, quoteAggregates] = await Promise.all([
      this.stats.aggregateAdminZones(since),
      this.searchLogRepository.aggregateByH3AndSignalSince(since),
      this.priceQuoteRepository.aggregateMultiplierByH3Since(since),
    ]);

    const supplyByCell = new Map(
      supplyZones.map((row) => [row.h3Cell, row]),
    );

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

    const weightedDemandByCell = new Map<string, number>();
    for (const [cell, counts] of countsByCell) {
      weightedDemandByCell.set(cell, computeWeightedDemand(counts));
    }

    const allCells = new Set<string>([
      ...supplyByCell.keys(),
      ...weightedDemandByCell.keys(),
    ]);

    const zones = Array.from(allCells)
      .filter(isH3CellInCaba)
      .map((h3Cell) => {
        const supply = supplyByCell.get(h3Cell);
        const supplyCount = supply?.supplyCount ?? 0;
        const demandCount = weightedDemandByCell.get(h3Cell) ?? 0;
        const ratio = supplyCount === 0 ? 0 : demandCount / supplyCount;
        const avgMultiplier = demandMultiplierFromRatio(ratio);
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
