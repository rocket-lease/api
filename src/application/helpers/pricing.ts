const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function computeReservationTotalCents(
  basePriceDailyCents: number,
  startAt: Date,
  endAt: Date,
  homeDeliveryFeeCents: number | null = null,
  homeReturnFeeCents: number | null = null,
): number {
  const ms = endAt.getTime() - startAt.getTime();
  let base = 0;
  if (ms > 0) {
    if (ms >= DAY_MS) {
      const days = Math.ceil(ms / DAY_MS);
      base = Math.round(days * basePriceDailyCents);
    } else {
      const hours = Math.ceil(ms / HOUR_MS);
      const hourlyRate = Math.round(basePriceDailyCents / 24);
      base = hours * hourlyRate;
    }
  }
  return base + (homeDeliveryFeeCents ?? 0) + (homeReturnFeeCents ?? 0);
}

/**
 * Calcula el monto de la seña a cobrar al confirmar la reserva, en cents.
 *
 * - Si `depositPercentage` es `null` (vehículo/set sin seña), devuelve `0`.
 * - Si tiene valor, devuelve `floor(total * pct / 100)`. Se usa `floor` (no
 *   `round`) para garantizar que la seña nunca exceda el total —el conductor
 *   paga *como mucho* el porcentaje pactado—.
 *
 * El resto a cobrar al retiro se calcula como `total - deposit`, no se
 * materializa acá.
 */
export function computeDepositCents(
  totalCents: number,
  depositPercentage: number | null,
): number {
  if (depositPercentage === null) return 0;
  if (totalCents <= 0) return 0;
  return Math.floor((totalCents * depositPercentage) / 100);
}
