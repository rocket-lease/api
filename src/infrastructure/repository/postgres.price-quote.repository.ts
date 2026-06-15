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
        levelDiscountPercentage: quote.getLevelDiscountPercentage() ?? null,
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
      levelDiscountPercentage: row.levelDiscountPercentage ?? undefined,
    });
  }

  public async countByHexSince(h3Cell: string, since: Date): Promise<number> {
    const conductors = await this.prisma.priceQuote.groupBy({
      by: ['conductorId'],
      where: {
        h3Cell,
        createdAt: { gte: since },
        conductorId: { not: null },
      },
    });
    return conductors.length;
  }

  public async aggregateMultiplierByH3Since(
    since: Date,
  ): Promise<PriceQuoteAggregatedZone[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ h3Cell: string; avgMultiplier: unknown; sampleSize: unknown }>
    >`
      SELECT
        h3_cell AS "h3Cell",
        AVG(multiplier) AS "avgMultiplier",
        COUNT(DISTINCT conductor_id) AS "sampleSize"
      FROM price_quotes
      WHERE created_at >= ${since}
      GROUP BY h3_cell
    `;
    return rows.map((row) => ({
      h3Cell: row.h3Cell,
      avgMultiplier: row.avgMultiplier ? Number(row.avgMultiplier) : 1.0,
      sampleSize: Number(row.sampleSize ?? 0),
    }));
  }

  public async deleteExpiredBefore(cutoff: Date): Promise<number> {
    const result = await this.prisma.priceQuote.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return result.count;
  }
}
