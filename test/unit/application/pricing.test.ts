import {
  computeDepositCents,
  computeReservationTotalCents,
} from '@/application/helpers/pricing';

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

describe('computeDepositCents', () => {
  it('returns 0 when depositPercentage is null (sin seña)', () => {
    expect(computeDepositCents(100000, null)).toBe(0);
  });

  it('returns 0 when total is 0 regardless of percentage', () => {
    expect(computeDepositCents(0, 30)).toBe(0);
  });

  it('returns floor(total * 10 / 100) at the lower bound', () => {
    expect(computeDepositCents(12345, 10)).toBe(Math.floor(12345 * 10 / 100));
  });

  it('returns floor(total * 50 / 100) at the upper bound', () => {
    expect(computeDepositCents(99999, 50)).toBe(Math.floor(99999 * 50 / 100));
  });

  it('floors the result to never exceed the configured pct', () => {
    // 199 * 33 / 100 = 65.67 → floor → 65, no 66.
    expect(computeDepositCents(199, 33)).toBe(65);
  });

  it('returns 0 when total is negative (defensive)', () => {
    expect(computeDepositCents(-100, 30)).toBe(0);
  });
});
