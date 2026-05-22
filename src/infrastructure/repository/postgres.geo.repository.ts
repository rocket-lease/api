import { Injectable, Inject } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type {
  GeoRepository,
  GeoSearchArea,
  GeoVehicle,
} from '@/domain/repositories/geo.repository';

@Injectable()
export class PostgresGeoRepository implements GeoRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAvailableVehiclesInArea(
    area: GeoSearchArea,
  ): Promise<GeoVehicle[]> {
    const and: Prisma.VehicleWhereInput[] = [
      { enabled: true },
      { latitude: { not: null, gte: area.south, lte: area.north } },
      { longitude: { not: null, gte: area.west, lte: area.east } },
    ];

    if (area.transmission) {
      and.push({ transmission: area.transmission });
    }

    if (area.maxPriceDailyCents !== undefined) {
      and.push({ basePriceCents: { lte: area.maxPriceDailyCents } });
    }

    if (area.isAccessible) {
      and.push({ isAccessible: true });
    }

    if (area.characteristics && area.characteristics.length > 0) {
      and.push(
        ...area.characteristics.map((item) => ({
          characteristics: { some: { characteristic: item } },
        })),
      );
    }

    if (area.from && area.to) {
      and.push({
        NOT: {
          reservations: {
            some: {
              status: { in: ['confirmed', 'in_progress'] },
              startAt: { lt: new Date(area.to) },
              endAt: { gt: new Date(area.from) },
            },
          },
        },
      });
    }

    const raws = await this.prisma.vehicle.findMany({
      where: { AND: and },
      select: {
        id: true,
        ownerId: true,
        brand: true,
        model: true,
        year: true,
        basePriceCents: true,
        latitude: true,
        longitude: true,
        photos: { orderBy: { url: 'asc' }, take: 1, select: { url: true } },
      },
    });

    return raws
      .filter(
        (r): r is typeof r & { latitude: number; longitude: number } =>
          r.latitude !== null && r.longitude !== null,
      )
      .map((r) => ({
        id: r.id,
        ownerId: r.ownerId,
        brand: r.brand,
        model: r.model,
        year: r.year,
        basePriceCents: r.basePriceCents,
        latitude: r.latitude,
        longitude: r.longitude,
        photo: r.photos[0]?.url ?? null,
      }));
  }
}
