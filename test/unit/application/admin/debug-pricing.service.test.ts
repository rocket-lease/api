import { NotFoundException } from '@nestjs/common';
import { DebugPricingService } from '@/application/admin/debug-pricing.service';
import type { PrismaService } from '@/infrastructure/database/prisma.service';
import type { Clock } from '@/domain/providers/clock.provider';

function buildService(): DebugPricingService {
  const prisma = {} as unknown as PrismaService;
  const clock: Clock = { now: () => new Date('2026-06-10T12:00:00.000Z') };
  return new DebugPricingService(prisma, clock);
}

describe('DebugPricingService.assertEnabled', () => {
  const original = process.env.PRICING_DEBUG_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.PRICING_DEBUG_ENABLED;
    else process.env.PRICING_DEBUG_ENABLED = original;
  });

  it('tira 404 cuando el flag no está activo', () => {
    delete process.env.PRICING_DEBUG_ENABLED;
    expect(() => buildService().assertEnabled()).toThrow(NotFoundException);
  });

  it('no tira cuando el flag está en "true"', () => {
    process.env.PRICING_DEBUG_ENABLED = 'true';
    expect(() => buildService().assertEnabled()).not.toThrow();
  });

  it('tira con cualquier valor distinto de "true"', () => {
    process.env.PRICING_DEBUG_ENABLED = '1';
    expect(() => buildService().assertEnabled()).toThrow(NotFoundException);
  });
});
