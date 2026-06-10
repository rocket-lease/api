/**
 * Repositorio de métricas de flota para el rentador (US "Dashboard de métricas").
 * Todo el cálculo (ocupación, ingresos, tasa de cancelación, top vehículos y el
 * umbral de baja ocupación) vive en la implementación; el service solo orquesta.
 */

export interface DashboardDateRange {
  from: Date;
  to: Date;
  /** Momento "ahora" (para el contador de reservas activas hoy). */
  now: Date;
}

/** Tramo ocupado del vehículo dentro del período (recortado al rango). */
export interface DashboardOccupiedRangeData {
  startAt: string;
  endAt: string;
}

/** Métrica agregada por vehículo (ocupación por vehículo + top rentados). */
export interface DashboardVehicleMetricData {
  vehicleId: string;
  brand: string;
  model: string;
  plate: string;
  photoUrl: string | null;
  occupancyRatePercent: number;
  occupiedRanges: DashboardOccupiedRangeData[];
  revenueCents: number;
  reservationCount: number;
  cancellationRatePercent: number;
  lowOccupancy: boolean;
}

export interface DashboardRevenuePointData {
  date: string; // YYYY-MM-DD
  totalCents: number;
}

/** Vehículo con baja ocupación a futuro (ventana fija, independiente del período). */
export interface DashboardAttentionVehicleData {
  vehicleId: string;
  brand: string;
  model: string;
  plate: string;
  upcomingOccupancyRatePercent: number;
}

export interface DashboardSummaryData {
  totalVehicles: number;
  activeReservations: number;
  monthlyRevenueCents: number;
  fleetOccupancyRatePercent: number;
  cancellationRatePercent: number;
  revenueByDay: DashboardRevenuePointData[];
  vehicles: DashboardVehicleMetricData[];
  topVehicles: DashboardVehicleMetricData[];
  attentionVehicles: DashboardAttentionVehicleData[];
}

export interface DashboardVehicleDetailData {
  vehicle: DashboardVehicleMetricData;
  revenueByDay: DashboardRevenuePointData[];
  reservationCount: number;
  cancelledCount: number;
}

export interface DashboardRepository {
  getSummary(
    rentadorId: string,
    range: DashboardDateRange,
  ): Promise<DashboardSummaryData>;

  /** Devuelve `null` si el vehículo no existe o no pertenece al rentador. */
  getVehicleDetail(
    rentadorId: string,
    vehicleId: string,
    range: DashboardDateRange,
  ): Promise<DashboardVehicleDetailData | null>;
}

export const DASHBOARD_REPOSITORY = Symbol('DashboardRepository');
