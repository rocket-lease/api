import { formatArs, formatNotificationDate } from '@/application/notification.format';

describe('formatArs', () => {
  it('formats integer cents with thousands separator and two decimals', () => {
    const formatted = formatArs(1500000);
    expect(formatted).toContain('15.000,00');
    expect(formatted).toMatch(/\$|ARS/);
  });

  it('formats zero with two decimals', () => {
    expect(formatArs(0)).toContain('0,00');
  });
});

describe('formatNotificationDate', () => {
  it('renders the date in the Buenos Aires timezone using 24h time', () => {
    // 2026-06-20T17:30:00Z is 14:30 in America/Argentina/Buenos_Aires (UTC-3).
    const formatted = formatNotificationDate(new Date('2026-06-20T17:30:00.000Z'));
    expect(formatted).toContain('20');
    expect(formatted).toContain('junio');
    expect(formatted).toContain('14:30');
  });
});
