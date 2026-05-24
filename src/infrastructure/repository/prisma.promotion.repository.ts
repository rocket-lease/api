import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  type PromotionRepository,
  type PromotionDuration,
} from '@/domain/repositories/promotion.repository';
import { Promotion } from '@/domain/entities/promotion/promotion.entity';
import { PromotionDays } from '@/domain/entities/promotion/promotion.days.entity';

@Injectable()
export class PrismaPromotionRepository implements PromotionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAllDurations(): Promise<PromotionDuration[]> {
    const rows = await this.prisma.promotionLengthInDays.findMany({
      orderBy: { days: 'asc' },
    });
    return rows.map((r) => ({ days: r.days, valueInCents: r.valueInCents }));
  }

  async save(promotion: Promotion): Promise<Promotion> {
    const data = {
      vehicleId: promotion.vehicleId,
      durationDays: promotion.durationDays,
      totalCents: promotion.totalCents,
      status: promotion.status,
      paymentMethod: promotion.paymentMethod,
      paidAt: promotion.paidAt,
      transactionId: promotion.transactionId,
      transferCode: promotion.transferCode,
      transferAlias: promotion.transferAlias,
      transferExpiresAt: promotion.transferExpiresAt,
      startDate: promotion.startDate,
    };

    await this.prisma.promotionActive.upsert({
      where: { vehicleId: promotion.vehicleId },
      update: data,
      create: data,
    });

    return promotion;
  }

  async findByVehicleId(vehicleId: string): Promise<Promotion | null> {
    const row = await this.prisma.promotionActive.findUnique({
      where: { vehicleId },
    });

    if (!row) return null;

    return this.rowToEntity(row);
  }

  async findAllActive(): Promise<Promotion[]> {
    const rows = await this.prisma.promotionActive.findMany();
    return rows.map((row) => this.rowToEntity(row));
  }

  async delete(vehicleId: string): Promise<void> {
    await this.prisma.promotionActive.delete({ where: { vehicleId } });
  }

  private rowToEntity(row: {
    vehicleId: string;
    durationDays: number;
    totalCents: number;
    status: string;
    paymentMethod: string;
    paidAt: Date | null;
    transactionId: string | null;
    transferCode: string | null;
    transferAlias: string | null;
    transferExpiresAt: Date | null;
    startDate: Date;
  }): Promotion {
    const days = new PromotionDays(row.durationDays, row.totalCents);
    return new Promotion(
      row.vehicleId,
      days,
      row.startDate,
      row.paymentMethod,
      row.status as 'active' | 'pending_approval',
      row.paidAt,
      row.transactionId,
      row.transferCode,
      row.transferAlias,
      row.transferExpiresAt,
    );
  }
}

export const PRISMA_PROMOTION_REPOSITORY_TOKEN = Symbol('PrismaPromotionRepository');
