import type { PricingDiscountTiers } from '@rocket-lease/contracts';
import {
  computeDepositCents,
  computePricingQuote,
  computeReservationTotalCents,
  selectAppliedDiscountTier,
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

  describe('seña sobre reserva con descuento (escenarios reales)', () => {
    // Helper que simula el cálculo completo: cotizar con descuento + seña
    function simulateDepositFlow(
      basePriceDailyCents: number,
      startAt: Date,
      endAt: Date,
      discountTiers: PricingDiscountTiers,
      depositPercentage: number | null,
    ) {
      const quote = computePricingQuote({
        vehicleId: 'v-test',
        basePriceDailyCents,
        discountTiers,
        startAt,
        endAt,
      });
      const deposit = computeDepositCents(quote.totalCents, depositPercentage);
      const balance = quote.totalCents - deposit;
      return { quote, deposit, balance };
    }

    it('Escenario real: 3 días, 15% descuento, 30% seña → deposit + balance = total con descuento', () => {
      const start = new Date('2026-06-01T10:00:00Z');
      const end = new Date('2026-06-04T10:00:00Z');
      const { quote, deposit, balance } = simulateDepositFlow(
        24000, start, end,
        [{ minimumDays: 3, discountPercentage: 15 }],
        30,
      );

      const subtotal = 3 * 24000;                          // 72000
      const discount = Math.floor((subtotal * 15) / 100);  // 10800
      expect(quote.totalCents).toBe(subtotal - discount);  // 61200
      expect(deposit).toBe(Math.floor((61200 * 30) / 100)); // 18360
      expect(balance).toBe(61200 - 18360);                  // 42840
      expect(deposit + balance).toBe(quote.totalCents);     // invariante
    });

    it('Escenario real: 7 días, 15% descuento, 50% seña', () => {
      const start = new Date('2026-06-01T10:00:00Z');
      const end = new Date('2026-06-08T10:00:00Z');
      const { quote, deposit, balance } = simulateDepositFlow(
        24000, start, end,
        [{ minimumDays: 7, discountPercentage: 15 }],
        50,
      );

      const subtotal = 7 * 24000;                          // 168000
      const discount = Math.floor((subtotal * 15) / 100);  // 25200
      expect(quote.totalCents).toBe(subtotal - discount);  // 142800
      expect(deposit).toBe(Math.floor((142800 * 50) / 100));
      expect(deposit + balance).toBe(quote.totalCents);
    });

    it('Escenario real: 2 días SIN descuento (no alcanza minimumDays), 30% seña', () => {
      const start = new Date('2026-06-01T10:00:00Z');
      const end = new Date('2026-06-03T10:00:00Z');
      const { quote, deposit, balance } = simulateDepositFlow(
        24000, start, end,
        [{ minimumDays: 3, discountPercentage: 15 }],
        30,
      );

      expect(quote.appliedDiscountTier).toBeNull();
      expect(quote.totalCents).toBe(2 * 24000);            // 48000, sin desc
      expect(deposit).toBe(Math.floor((48000 * 30) / 100));
      expect(deposit + balance).toBe(quote.totalCents);
    });

    it('sin seña (depositPercentage=null) devuelve deposit=0 y balance=total', () => {
      const start = new Date('2026-06-01T10:00:00Z');
      const end = new Date('2026-06-04T10:00:00Z');
      const { quote, deposit, balance } = simulateDepositFlow(
        24000, start, end,
        [{ minimumDays: 3, discountPercentage: 10 }],
        null,
      );

      expect(deposit).toBe(0);
      expect(balance).toBe(quote.totalCents);
    });

    it('múltiples tiers: elige el mejor descuento, seña sobre ese total', () => {
      const start = new Date('2026-06-01T10:00:00Z');
      const end = new Date('2026-06-15T10:00:00Z'); // 14 días
      const { quote, deposit, balance } = simulateDepositFlow(
        10000, start, end,
        [
          { minimumDays: 3, discountPercentage: 5 },
          { minimumDays: 7, discountPercentage: 10 },
          { minimumDays: 14, discountPercentage: 20 },
        ],
        30,
      );

      expect(quote.appliedDiscountPercentage).toBe(20);
      expect(quote.totalCents).toBe(14 * 10000 - Math.floor((140000 * 20) / 100));
      expect(deposit + balance).toBe(quote.totalCents);
    });
  });
});

describe('selectAppliedDiscountTier', () => {
  it('returns null when no tiers match the duration', () => {
    const result = selectAppliedDiscountTier(2, [{ minimumDays: 7, discountPercentage: 10 }]);
    expect(result).toBeNull();
  });

  it('returns the matching tier for exact minimum day', () => {
    const result = selectAppliedDiscountTier(7, [{ minimumDays: 7, discountPercentage: 10 }]);
    expect(result).toEqual({ minimumDays: 7, discountPercentage: 10 });
  });

  it('returns the matching tier when duration exceeds minimum', () => {
    const result = selectAppliedDiscountTier(10, [{ minimumDays: 7, discountPercentage: 10 }]);
    expect(result).toEqual({ minimumDays: 7, discountPercentage: 10 });
  });

  it('returns the highest matching tier when multiple tiers apply', () => {
    const tiers = [
      { minimumDays: 3, discountPercentage: 5 },
      { minimumDays: 7, discountPercentage: 10 },
      { minimumDays: 14, discountPercentage: 20 },
    ];
    // 10 days → tier 7d matches (10%), not 14d
    const result = selectAppliedDiscountTier(10, tiers);
    expect(result).toEqual({ minimumDays: 7, discountPercentage: 10 });
  });

  it('returns the highest tier for very long durations', () => {
    const tiers = [
      { minimumDays: 3, discountPercentage: 5 },
      { minimumDays: 7, discountPercentage: 10 },
      { minimumDays: 14, discountPercentage: 20 },
    ];
    const result = selectAppliedDiscountTier(30, tiers);
    expect(result).toEqual({ minimumDays: 14, discountPercentage: 20 });
  });

  it('handles unsorted tiers (sorts internally)', () => {
    const tiers = [
      { minimumDays: 14, discountPercentage: 20 },
      { minimumDays: 3, discountPercentage: 5 },
      { minimumDays: 7, discountPercentage: 10 },
    ];
    const result = selectAppliedDiscountTier(10, tiers);
    expect(result).toEqual({ minimumDays: 7, discountPercentage: 10 });
  });

  it('returns null for empty tiers array', () => {
    const result = selectAppliedDiscountTier(5, []);
    expect(result).toBeNull();
  });
});

describe('computePricingQuote', () => {
  it('computes a quote without discount', () => {
    const startAt = new Date('2026-06-01T10:00:00Z');
    const endAt = new Date('2026-06-04T10:00:00Z');
    const result = computePricingQuote({
      vehicleId: 'v1',
      basePriceDailyCents: 24000,
      discountTiers: [],
      startAt,
      endAt,
    });
    expect(result.subtotalCents).toBe(3 * 24000);
    expect(result.totalCents).toBe(3 * 24000);
    expect(result.appliedDiscountTier).toBeNull();
    expect(result.appliedDiscountPercentage).toBe(0);
    expect(result.discountCents).toBe(0);
  });

  it('applies a discount when duration meets the tier', () => {
    const startAt = new Date('2026-06-01T10:00:00Z');
    const endAt = new Date('2026-06-08T10:00:00Z'); // 7 days
    const result = computePricingQuote({
      vehicleId: 'v1',
      basePriceDailyCents: 10000,
      discountTiers: [{ minimumDays: 7, discountPercentage: 15 }],
      startAt,
      endAt,
    });
    expect(result.subtotalCents).toBe(7 * 10000); // 70000
    expect(result.discountCents).toBe(Math.floor((70000 * 15) / 100)); // 10500
    expect(result.totalCents).toBe(70000 - 10500); // 59500
    expect(result.appliedDiscountPercentage).toBe(15);
  });

  it('applies the best discount when multiple tiers match', () => {
    const startAt = new Date('2026-06-01T10:00:00Z');
    const endAt = new Date('2026-06-15T10:00:00Z'); // 14 days
    const result = computePricingQuote({
      vehicleId: 'v1',
      basePriceDailyCents: 10000,
      discountTiers: [
        { minimumDays: 3, discountPercentage: 5 },
        { minimumDays: 7, discountPercentage: 10 },
        { minimumDays: 14, discountPercentage: 20 },
      ],
      startAt,
      endAt,
    });
    expect(result.subtotalCents).toBe(14 * 10000);
    expect(result.appliedDiscountPercentage).toBe(20);
    expect(result.discountCents).toBe(Math.floor((140000 * 20) / 100));
    expect(result.totalCents).toBe(140000 - 28000);
  });

  it('rounds discount down (floor) to never over-discount', () => {
    const startAt = new Date('2026-06-01T10:00:00Z');
    const endAt = new Date('2026-06-03T10:00:00Z'); // 2 days
    const result = computePricingQuote({
      vehicleId: 'v1',
      basePriceDailyCents: 100,
      discountTiers: [{ minimumDays: 2, discountPercentage: 33 }],
      startAt,
      endAt,
    });
    // subtotal = 200, 33% → 66, floor(66) = 66
    expect(result.discountCents).toBe(Math.floor((200 * 33) / 100));
    expect(result.totalCents).toBe(200 - result.discountCents);
  });

  it('throws when endAt <= startAt', () => {
    const t = new Date('2026-06-01T10:00:00Z');
    expect(() =>
      computePricingQuote({
        vehicleId: 'v1',
        basePriceDailyCents: 10000,
        discountTiers: [],
        startAt: t,
        endAt: t,
      }),
    ).toThrow('endAt must be after startAt');
  });
});
