/**
 * Repositorio que agrupa las consultas estadísticas que alimentan al motor
 * de pricing dinámico. Centralizar acá las queries evita inflar el repo de
 * reservas / vehículos con métodos que solo usa este módulo.
 */
export interface PricingStatsRepository {
  /**
   * Cuenta reservas no canceladas/rechazadas/expiradas para el vehículo desde
   * el cutoff `since`. Se usa para detectar cold start (vehículos con poca
   * historia obtienen factor de utilización neutro).
   */
  countConfirmedReservationsSince(vehicleId: string, since: Date): Promise<number>;

  /**
   * Devuelve la utilización (0..1) del vehículo en la ventana de los próximos
   * `windowDays` días: car-days bookeados / total car-days.
   */
  computeUtilizationForWindow(vehicleId: string, windowDays: number): Promise<number>;

  /**
   * Cuenta reservas confirmadas (no canceladas/rechazadas/expiradas) cuyo
   * vehículo cae dentro del hex H3 dado, desde el cutoff `since`.
   */
  countConfirmedInHexSince(h3Cell: string, since: Date): Promise<number>;

  /**
   * Cuenta vehículos disponibles (enabled=true) cuya lat/lng cae dentro del
   * hex H3 dado. Se usa para calcular el ratio demanda/oferta.
   */
  countAvailableInHex(h3Cell: string): Promise<number>;

  /**
   * Devuelve estadísticas por hex H3 para el admin map: oferta, demanda
   * (search logs + reservas ponderadas), vehículos sample, etc.
   */
  aggregateAdminZones(since: Date): Promise<AdminPricingZoneAggregate[]>;
}

export interface AdminPricingZoneAggregate {
  h3Cell: string;
  supplyCount: number;
  demandSearchCount: number;
  demandReservationCount: number;
  vehicleSampleIds: string[];
}

export const PRICING_STATS_REPOSITORY = Symbol('PricingStatsRepository');
