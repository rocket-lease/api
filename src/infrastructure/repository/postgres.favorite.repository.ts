import { Injectable } from '@nestjs/common';
import { Favorite } from '@/domain/entities/favorite.entity';
import type { FavoriteRepository } from '@/domain/repositories/favorite.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PostgresFavoriteRepository implements FavoriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  private reconstitute(row: { id: string; conductorId: string; vehicleId: string; createdAt: Date }): Favorite {
    return new Favorite(row.id, row.conductorId, row.vehicleId, row.createdAt);
  }

  async save(favorite: Favorite): Promise<Favorite> {
    const row = await this.prisma.favorite.create({
      data: {
        id: favorite.id,
        conductorId: favorite.conductorId,
        vehicleId: favorite.vehicleId,
        createdAt: favorite.createdAt,
      },
    });
    return this.reconstitute(row);
  }

  async delete(conductorId: string, vehicleId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({
      where: { conductorId, vehicleId },
    });
  }

  async findByConductor(conductorId: string): Promise<Favorite[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { conductorId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.reconstitute(r));
  }

  async findByConductorAndVehicle(conductorId: string, vehicleId: string): Promise<Favorite | null> {
    const row = await this.prisma.favorite.findUnique({
      where: { conductorId_vehicleId: { conductorId, vehicleId } },
    });
    return row ? this.reconstitute(row) : null;
  }
}
