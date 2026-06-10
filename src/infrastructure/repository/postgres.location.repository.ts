import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type {
  LocationGeometrySeed,
  LocationH3CellSeed,
  LocationRecord,
  LocationRepository,
  LocationSeed,
} from '@/domain/repositories/location.repository';
import type { Prisma } from '@prisma/client';

@Injectable()
export class PostgresLocationRepository implements LocationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async findAllEnabled(): Promise<LocationRecord[]> {
    const rows = await this.prisma.location.findMany({
      where: { enabled: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.mapRecord(row));
  }

  public async findEnabledByCode(code: string): Promise<LocationRecord | null> {
    const row = await this.prisma.location.findFirst({
      where: { code, enabled: true },
    });
    return row ? this.mapRecord(row) : null;
  }

  public async upsertLocation(seed: LocationSeed): Promise<void> {
    await this.prisma.location.upsert({
      where: { code: seed.code },
      create: {
        id: seed.code,
        code: seed.code,
        name: seed.name,
        type: seed.type,
        parentId: seed.parentCode,
        provinceCode: seed.provinceCode,
        cityName: seed.cityName,
        displayOrder: seed.displayOrder,
        centerLat: seed.center?.latitude,
        centerLng: seed.center?.longitude,
      },
      update: {
        name: seed.name,
        type: seed.type,
        parentId: seed.parentCode,
        provinceCode: seed.provinceCode,
        cityName: seed.cityName,
        displayOrder: seed.displayOrder,
        centerLat: seed.center?.latitude,
        centerLng: seed.center?.longitude,
        enabled: true,
      },
    });
  }

  public async replaceCoverage(
    locationId: string,
    cells: LocationH3CellSeed[],
    geometry?: LocationGeometrySeed,
  ): Promise<void> {
    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.locationH3Cell.deleteMany({ where: { locationId } }),
      this.prisma.locationH3Cell.createMany({
        data: cells.map((cell) => ({
          locationId,
          h3Cell: cell.h3Cell,
          weight: cell.weight,
        })),
      }),
    ];
    if (geometry) {
      operations.push(
        this.prisma.locationGeometry.upsert({
          where: { locationId },
          create: {
            locationId,
            geometry: geometry.geometry,
            source: geometry.source,
            version: geometry.version,
          },
          update: {
            geometry: geometry.geometry,
            source: geometry.source,
            version: geometry.version,
          },
        }),
      );
    }
    await this.prisma.$transaction(operations);
  }

  private mapRecord(row: {
    id: string;
    code: string;
    name: string;
    type: string;
    parentId: string | null;
    cityName: string | null;
    centerLat: number | null;
    centerLng: number | null;
  }): LocationRecord {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      parentId: row.parentId,
      cityName: row.cityName,
      centerLat: row.centerLat,
      centerLng: row.centerLng,
    };
  }
}
