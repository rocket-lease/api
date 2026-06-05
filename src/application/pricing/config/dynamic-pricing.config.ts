/**
 * Bounds globales del multiplier dinámico. Cualquier composición de factores
 * se clampea a este rango antes de aplicarse al precio.
 */
export const DYNAMIC_PRICING_MIN = 0.7;
export const DYNAMIC_PRICING_MAX = 2.0;
export const DYNAMIC_PRICING_NEUTRAL = 1.0;

/**
 * TTL del PriceQuote: ventana de validez del precio congelado tras la
 * cotización antes de tener que recotizar.
 */
export const PRICE_QUOTE_TTL_MS = 5 * 60 * 1000;

/**
 * Configuración del factor de utilización individual del vehículo.
 *  - `coldStartThreshold`: si el vehículo tiene menos reservas confirmadas
 *    que este número en `coldStartWindowDays`, el factor devuelve 1.0
 *    (no castiga vehículos nuevos).
 *  - `bucketThresholds`: ratios de utilización en próximos 30 días que
 *    disparan cada multiplier.
 */
export const UTILIZATION_FACTOR = {
  coldStartThreshold: 5,
  coldStartWindowDays: 60,
  forecastWindowDays: 30,
  buckets: {
    veryHigh: { utilization: 0.95, multiplier: 1.5 },
    high: { utilization: 0.85, multiplier: 1.3 },
    medium: { utilization: 0.7, multiplier: 1.15 },
    low: { utilization: 0.4, multiplier: 0.9 },
  },
  neutral: 1.0,
} as const;

/**
 * Configuración del factor de demanda zonal (H3).
 *  - `demandWindowDays`: cuánta historia mirar (search logs + reservas).
 *  - `reservationWeight`: cuánto pesa cada reserva confirmada frente a una
 *    búsqueda al computar la demanda agregada.
 *  - `ratioThresholds`: ratios demand/supply que disparan cada multiplier.
 */
export const DEMAND_ZONE_FACTOR = {
  demandWindowDays: 7,
  reservationWeight: 3,
  ratioThresholds: {
    veryHigh: { ratio: 10, multiplier: 1.25 },
    high: { ratio: 5, multiplier: 1.15 },
    low: { ratio: 1, multiplier: 0.95 },
  },
  neutral: 1.0,
} as const;

/**
 * Lead-time: cuán cerca está la fecha de pickup.
 */
export const LEAD_TIME_FACTOR = {
  shortLeadDays: 1,
  shortLeadMultiplier: 1.2,
  longLeadDays: 21,
  longLeadMultiplier: 0.9,
  neutral: 1.0,
} as const;

/**
 * Factor de fin de semana: si el rango incluye sábado o domingo.
 */
export const WEEKEND_FACTOR = {
  withWeekendMultiplier: 1.15,
  neutral: 1.0,
} as const;

export function clampMultiplier(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return DYNAMIC_PRICING_NEUTRAL;
  }
  if (value < DYNAMIC_PRICING_MIN) return DYNAMIC_PRICING_MIN;
  if (value > DYNAMIC_PRICING_MAX) return DYNAMIC_PRICING_MAX;
  return value;
}
