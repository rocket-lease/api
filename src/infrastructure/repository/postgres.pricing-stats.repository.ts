import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  type AdminPricingZoneAggregate,
  type PricingStatsRepository,
} from '@/domain/repositories/pricing-stats.repository';
import { latLonToH3 } from '@/application/helpers/h3';

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
    const rows = await this.prisma.reservation.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        createdAt: { gte: since },
        vehicle: {
          latitude: { not: null },
          longitude: { not: null },
        },
      },
      select: {
        vehicle: { select: { latitude: true, longitude: true } },
      },
    });
    let count = 0;
    for (const row of rows) {
      const cell = latLonToH3(
        row.vehicle.latitude,
        row.vehicle.longitude,
      );
      if (cell === h3Cell) count += 1;
    }
    return count;
  }

  public async countAvailableInHex(h3Cell: string): Promise<number> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        enabled: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { latitude: true, longitude: true },
    });
    let count = 0;
    for (const v of vehicles) {
      const cell = latLonToH3(v.latitude, v.longitude);
      if (cell === h3Cell) count += 1;
    }
    return count;
  }

  public async aggregateAdminZones(
    since: Date,
  ): Promise<AdminPricingZoneAggregate[]> {
    const [vehicles, reservations] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: {
          enabled: true,
          latitude: { not: null },
          longitude: { not: null },
        },
        select: { id: true, latitude: true, longitude: true },
      }),
      this.prisma.reservation.findMany({
        where: {
          status: { in: [...ACTIVE_STATUSES] },
          createdAt: { gte: since },
          vehicle: {
            latitude: { not: null },
            longitude: { not: null },
          },
        },
        select: {
          vehicleId: true,
          vehicle: { select: { latitude: true, longitude: true } },
        },
      }),
    ]);

    const byCell = new Map<string, AdminPricingZoneAggregate>();

    for (const v of vehicles) {
      const cell = latLonToH3(v.latitude, v.longitude);
      if (!cell) continue;
      const current = byCell.get(cell);
      if (current) {
        current.supplyCount += 1;
        if (current.vehicleSampleIds.length < 10) {
          current.vehicleSampleIds.push(v.id);
        }
      } else {
        byCell.set(cell, {
          h3Cell: cell,
          supplyCount: 1,
          demandSearchCount: 0,
          demandReservationCount: 0,
          vehicleSampleIds: [v.id],
        });
      }
    }

    for (const r of reservations) {
      const cell = latLonToH3(
        r.vehicle.latitude,
        r.vehicle.longitude,
      );
      if (!cell) continue;
      const current = byCell.get(cell);
      if (current) {
        current.demandReservationCount += 1;
      } else {
        byCell.set(cell, {
          h3Cell: cell,
          supplyCount: 0,
          demandSearchCount: 0,
          demandReservationCount: 1,
          vehicleSampleIds: [],
        });
      }
    }

    return Array.from(byCell.values());
  }
}
