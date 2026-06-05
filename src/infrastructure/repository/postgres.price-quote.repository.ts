import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PriceQuote } from '@/domain/entities/price-quote.entity';
import {
  PriceQuoteRepository,
  type PriceQuoteAggregatedZone,
} from '@/domain/repositories/price-quote.repository';

@Injectable()
export class PostgresPriceQuoteRepository implements PriceQuoteRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async save(quote: PriceQuote): Promise<PriceQuote> {
    await this.prisma.priceQuote.create({
      data: {
        id: quote.getId(),
        vehicleId: quote.getVehicleId(),
        conductorId: quote.getConductorId(),
        startAt: quote.getStartAt(),
        endAt: quote.getEndAt(),
        basePriceCents: quote.getBasePriceCents(),
        multiplier: quote.getMultiplier(),
        discountPercentage: quote.getDiscountPercentage(),
        deliveryFeeCents: quote.getDeliveryFeeCents(),
        totalCents: quote.getTotalCents(),
        currency: quote.getCurrency(),
        h3Cell: quote.getH3Cell(),
        createdAt: quote.getCreatedAt(),
        expiresAt: quote.getExpiresAt(),
      },
    });
    return quote;
  }

  public async findById(id: string): Promise<PriceQuote | null> {
    const row = await this.prisma.priceQuote.findUnique({ where: { id } });
    if (!row) return null;
    return new PriceQuote({
      id: row.id,
      vehicleId: row.vehicleId,
      conductorId: row.conductorId,
      startAt: row.startAt,
      endAt: row.endAt,
      basePriceCents: row.basePriceCents,
      multiplier: Number(row.multiplier),
      discountPercentage: row.discountPercentage,
      deliveryFeeCents: row.deliveryFeeCents,
      totalCents: row.totalCents,
      currency: row.currency,
      h3Cell: row.h3Cell,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    });
  }

  public async aggregateMultiplierByH3Since(
    since: Date,
  ): Promise<PriceQuoteAggregatedZone[]> {
    const rows = await this.prisma.priceQuote.groupBy({
      by: ['h3Cell'],
      where: { createdAt: { gte: since } },
      _avg: { multiplier: true },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      h3Cell: row.h3Cell,
      avgMultiplier: row._avg.multiplier ? Number(row._avg.multiplier) : 1.0,
      sampleSize: row._count._all,
    }));
  }

  public async deleteExpiredBefore(cutoff: Date): Promise<number> {
    const result = await this.prisma.priceQuote.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return result.count;
  }
}
