import { Favorite } from '../entities/favorite.entity';

export interface FavoriteRepository {
  save(favorite: Favorite): Promise<Favorite>;
  delete(conductorId: string, vehicleId: string): Promise<void>;
  findByConductor(conductorId: string): Promise<Favorite[]>;
  findByConductorAndVehicle(conductorId: string, vehicleId: string): Promise<Favorite | null>;
}

export const FAVORITE_REPOSITORY = Symbol('FavoriteRepository');
