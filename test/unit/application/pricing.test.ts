import { computeReservationTotalCents } from '@/application/helpers/pricing';

describe('computeReservationTotalCents', () => {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const basePrice = 24000; // cents per day

  it('returns 0 for non-positive durations', () => {
    const t = new Date('2026-06-01T10:00:00Z');
    expect(computeReservationTotalCents(basePrice, t, t)).toBe(0);
  });

  it('charges per day when duration >= 24h', () => {
    const start = new Date('2026-06-01T10:00:00Z');
    const end = new Date(start.getTime() + 2 * DAY);
    expect(computeReservationTotalCents(basePrice, start, end)).toBe(
      2 * basePrice,
    );
  });

  it('rounds up partial days when duration > 24h', () => {
    const start = new Date('2026-06-01T10:00:00Z');
    const end = new Date(start.getTime() + DAY + HOUR);
    expect(computeReservationTotalCents(basePrice, start, end)).toBe(
      2 * basePrice,
    );
  });

  it('charges per hour when duration < 24h', () => {
    const start = new Date('2026-06-01T10:00:00Z');
    const end = new Date(start.getTime() + 3 * HOUR);
    const hourly = Math.round(basePrice / 24);
    expect(computeReservationTotalCents(basePrice, start, end)).toBe(
      3 * hourly,
    );
  });

  it('rounds up partial hours', () => {
    const start = new Date('2026-06-01T10:00:00Z');
    const end = new Date(start.getTime() + 90 * 60 * 1000);
    const hourly = Math.round(basePrice / 24);
    expect(computeReservationTotalCents(basePrice, start, end)).toBe(
      2 * hourly,
    );
  });
});
