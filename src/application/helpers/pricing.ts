const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function computeReservationTotalCents(
  basePriceDailyCents: number,
  startAt: Date,
  endAt: Date,
): number {
  const ms = endAt.getTime() - startAt.getTime();
  if (ms <= 0) return 0;
  if (ms >= DAY_MS) {
    const days = Math.ceil(ms / DAY_MS);
    return Math.round(days * basePriceDailyCents);
  }
  const hours = Math.ceil(ms / HOUR_MS);
  const hourlyRate = Math.round(basePriceDailyCents / 24);
  return hours * hourlyRate;
}
