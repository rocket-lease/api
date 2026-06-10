/**
 * Bounds globales del multiplier dinámico. Cualquier composición de factores
 * se clampea a este rango antes de aplicarse al precio. El piso es la tarifa
 * base (1.0): el motor solo infla el precio, nunca lo descuenta por debajo.
 * Los factores a la baja pueden moderar un surge, pero el resultado final
 * jamás queda por debajo de la base.
 */
export const DYNAMIC_PRICING_MIN = 1.0;
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
 *
 * Modelamos demanda como la suma ponderada de cuatro señales que reflejan
 * intención creciente: una búsqueda viewport es ambient, ver el detalle de
 * un vehículo es intent, cotizarlo es high intent y reservarlo es la
 * conversión real. Los pesos relativos los validamos contra benchmarks de
 * P2P rental marketplaces (ver `docs/adr/0008-weighted-demand-signals.md`).
 *
 *  - `demandWindowDays`: cuánta historia mirar (todas las señales).
 *  - `signalWeights`: ponderación relativa de cada `SearchSignal`.
 *  - `ratioThresholds`: ratios demand/supply que disparan cada multiplier.
 */
export const DEMAND_ZONE_FACTOR = {
  demandWindowDays: 7,
  signalWeights: {
    search: 1,
    vehicleView: 5,
    quote: 20,
    reservation: 50,
  },
  /**
   * Rampa continua de surge por demanda. Por debajo de `startRatio`
   * (demanda ≤ oferta) no hay surge; sube linealmente hasta `maxMultiplier`
   * cuando la demanda llega a `fullRatio` veces la oferta. Solo infla.
   */
  surge: {
    startRatio: 1,
    fullRatio: 20,
    maxMultiplier: 1.5,
  },
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
