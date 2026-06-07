import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  type AdminPricingZoneAggregate,
  type PricingStatsRepository,
} from '@/domain/repositories/pricing-stats.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

const ACTIVE_STATUSES = ['confirmed', 'in_progress', 'completed'] as const;

@Injectable()
export class PostgresPricingStatsRepository implements PricingStatsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async countConfirmedReservationsSince(
    vehicleId: string,
    since: Date,
  ): Promise<number> {
    return this.prisma.reservation.count({
      where: {
        vehicleId,
        status: { in: [...ACTIVE_STATUSES] },
        createdAt: { gte: since },
      },
    });
  }

  public async computeUtilizationForWindow(
    vehicleId: string,
    windowDays: number,
  ): Promise<number> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowDays * DAY_MS);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        vehicleId,
        status: { in: ['confirmed', 'in_progress', 'pending_payment'] },
        startAt: { lt: windowEnd },
        endAt: { gt: now },
      },
      select: { startAt: true, endAt: true },
    });
    let bookedMs = 0;
    for (const r of reservations) {
      const start = Math.max(r.startAt.getTime(), now.getTime());
      const end = Math.min(r.endAt.getTime(), windowEnd.getTime());
      if (end > start) bookedMs += end - start;
    }
    const totalMs = windowDays * DAY_MS;
    if (totalMs === 0) return 0;
    return bookedMs / totalMs;
  }

  public async countConfirmedInHexSince(
    h3Cell: string,
    since: Date,
  ): Promise<number> {
    return this.prisma.reservation.count({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        createdAt: { gte: since },
        vehicle: { h3Cell },
      },
    });
  }

  public async countAvailableInHex(h3Cell: string): Promise<number> {
    return this.prisma.vehicle.count({
      where: { enabled: true, h3Cell },
    });
  }

  public async aggregateAdminZones(
    since: Date,
  ): Promise<AdminPricingZoneAggregate[]> {
    const [vehicles, reservations] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { enabled: true, h3Cell: { not: null } },
        select: { id: true, h3Cell: true },
      }),
      this.prisma.reservation.findMany({
        where: {
          status: { in: [...ACTIVE_STATUSES] },
          createdAt: { gte: since },
          vehicle: { h3Cell: { not: null } },
        },
        select: {
          vehicleId: true,
          vehicle: { select: { h3Cell: true } },
        },
      }),
    ]);

    const byCell = new Map<string, AdminPricingZoneAggregate>();
    const ensureCell = (cell: string): AdminPricingZoneAggregate => {
      let current = byCell.get(cell);
      if (!current) {
        current = {
          h3Cell: cell,
          supplyCount: 0,
          demandSearchCount: 0,
          demandReservationCount: 0,
          vehicleSampleIds: [],
        };
        byCell.set(cell, current);
      }
      return current;
    };

    for (const v of vehicles) {
      if (!v.h3Cell) continue;
      const current = ensureCell(v.h3Cell);
      current.supplyCount += 1;
      if (current.vehicleSampleIds.length < 10) {
        current.vehicleSampleIds.push(v.id);
      }
    }

    for (const r of reservations) {
      const cell = r.vehicle.h3Cell;
      if (!cell) continue;
      ensureCell(cell).demandReservationCount += 1;
    }

    return Array.from(byCell.values());
  }
}
