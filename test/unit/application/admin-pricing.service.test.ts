import { AdminPricingService } from '@/application/admin/admin-pricing.service';
import { latLonToH3 } from '@/application/helpers/h3';
import type { PricingStatsRepository } from '@/domain/repositories/pricing-stats.repository';
import type { SearchLogRepository } from '@/domain/repositories/search-log.repository';
import type { PriceQuoteRepository } from '@/domain/repositories/price-quote.repository';
import type { Clock } from '@/domain/providers/clock.provider';

describe('AdminPricingService', () => {
  it('excludes demand-only cells outside the CABA admin map area', async () => {
    const cabaCell = latLonToH3(-34.6037, -58.3816)!;
    const riverCell = latLonToH3(-34.62, -58.29)!;
    const stats = {
      aggregateAdminZones: jest.fn().mockResolvedValue([]),
    } as unknown as PricingStatsRepository;
    const searchLogs = {
      aggregateByH3AndSignalSince: jest.fn().mockResolvedValue([
        { h3Cell: cabaCell, signal: 'search', count: 1 },
        { h3Cell: riverCell, signal: 'search', count: 2 },
      ]),
    } as unknown as SearchLogRepository;
    const quotes = {
      aggregateMultiplierByH3Since: jest.fn().mockResolvedValue([]),
    } as unknown as PriceQuoteRepository;
    const clock = {
      now: () => new Date('2026-06-07T12:00:00.000Z'),
    } as Clock;

    const result = await new AdminPricingService(
      stats,
      searchLogs,
      quotes,
      clock,
    ).aggregateZones();

    expect(result.zones.map((zone) => zone.h3Cell)).toEqual([cabaCell]);
    expect(result.zones[0]?.demandCount).toBe(1);
  });
});
