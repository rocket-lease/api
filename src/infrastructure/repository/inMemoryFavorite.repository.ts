import { Injectable } from '@nestjs/common';
import { Favorite } from '@/domain/entities/favorite.entity';
import type { FavoriteRepository } from '@/domain/repositories/favorite.repository';

@Injectable()
export class InMemoryFavoriteRepository implements FavoriteRepository {
  private readonly storage: Map<string, Favorite> = new Map();

  async save(favorite: Favorite): Promise<Favorite> {
    const key = `${favorite.conductorId}:${favorite.vehicleId}`;
    this.storage.set(key, favorite);
    return favorite;
  }

  async delete(conductorId: string, vehicleId: string): Promise<void> {
    this.storage.delete(`${conductorId}:${vehicleId}`);
  }

  async findByConductor(conductorId: string): Promise<Favorite[]> {
    return Array.from(this.storage.values()).filter(
      (f) => f.conductorId === conductorId,
    );
  }

  async findByConductorAndVehicle(
    conductorId: string,
    vehicleId: string,
  ): Promise<Favorite | null> {
    return this.storage.get(`${conductorId}:${vehicleId}`) ?? null;
  }
}
