import { Inject, Injectable } from '@nestjs/common';
import {
  type AddFavoriteRequest,
  type AddFavoriteResponse,
  AddFavoriteResponseSchema,
  type ListFavoritesResponse,
  ListFavoritesResponseSchema,
} from '@rocket-lease/contracts';
import { Favorite } from '@/domain/entities/favorite.entity';
import {
  FavoriteAlreadyExistsException,
  FavoriteNotFoundException,
} from '@/domain/exceptions/domain.exception';
import type { FavoriteRepository } from '@/domain/repositories/favorite.repository';
import { FAVORITE_REPOSITORY } from '@/domain/repositories/favorite.repository';

@Injectable()
export class FavoriteService {
  constructor(
    @Inject(FAVORITE_REPOSITORY)
    private readonly favoriteRepository: FavoriteRepository,
  ) {}

  async addFavorite(
    conductorId: string,
    dto: AddFavoriteRequest,
  ): Promise<AddFavoriteResponse> {
    const existing = await this.favoriteRepository.findByConductorAndVehicle(
      conductorId,
      dto.vehicleId,
    );
    if (existing) throw new FavoriteAlreadyExistsException(dto.vehicleId);

    const favorite = new Favorite(undefined, conductorId, dto.vehicleId);
    const saved = await this.favoriteRepository.save(favorite);

    return AddFavoriteResponseSchema.parse({
      id: saved.id,
      vehicleId: saved.vehicleId,
      conductorId: saved.conductorId,
      createdAt: saved.createdAt.toISOString(),
    });
  }

  async removeFavorite(conductorId: string, vehicleId: string): Promise<void> {
    const existing = await this.favoriteRepository.findByConductorAndVehicle(
      conductorId,
      vehicleId,
    );
    if (!existing) throw new FavoriteNotFoundException(vehicleId);
    await this.favoriteRepository.delete(conductorId, vehicleId);
  }

  async listFavorites(conductorId: string): Promise<ListFavoritesResponse> {
    const favorites = await this.favoriteRepository.findByConductor(conductorId);
    return ListFavoritesResponseSchema.parse({
      items: favorites.map((fav) => ({
        id: fav.id,
        vehicleId: fav.vehicleId,
        createdAt: fav.createdAt.toISOString(),
      })),
    });
  }
}
