import { Inject, Injectable } from '@nestjs/common';
import {
  PRICING_STATS_REPOSITORY,
  type PricingStatsRepository,
} from '@/domain/repositories/pricing-stats.repository';
import {
  SEARCH_LOG_REPOSITORY,
  type SearchLogRepository,
} from '@/domain/repositories/search-log.repository';
import { DEMAND_ZONE_FACTOR } from '../config/dynamic-pricing.config';
import { latLonToH3 } from '@/application/helpers/h3';

/**
 * Factor de demanda zonal: mide la presión sobre el hex H3 del vehículo
 * comparando búsquedas + reservas recientes contra el inventario disponible
 * en ese hex.
 */
@Injectable()
export class DemandZoneFactor {
  constructor(
    @Inject(PRICING_STATS_REPOSITORY)
    private readonly stats: PricingStatsRepository,
    @Inject(SEARCH_LOG_REPOSITORY)
    private readonly searchLogRepository: SearchLogRepository,
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
      Date.now() - DEMAND_ZONE_FACTOR.demandWindowDays * 24 * 60 * 60 * 1000,
    );
    const [searches, reservations, supply] = await Promise.all([
      this.searchLogRepository.countByHexSince(h3Cell, since),
      this.stats.countConfirmedInHexSince(h3Cell, since),
      this.stats.countAvailableInHex(h3Cell),
    ]);
    if (supply === 0) return DEMAND_ZONE_FACTOR.neutral;
    const demand =
      searches + reservations * DEMAND_ZONE_FACTOR.reservationWeight;
    const ratio = demand / supply;
    const thresholds = DEMAND_ZONE_FACTOR.ratioThresholds;
    if (ratio > thresholds.veryHigh.ratio) return thresholds.veryHigh.multiplier;
    if (ratio > thresholds.high.ratio) return thresholds.high.multiplier;
    if (ratio < thresholds.low.ratio) return thresholds.low.multiplier;
    return DEMAND_ZONE_FACTOR.neutral;
  }
}
