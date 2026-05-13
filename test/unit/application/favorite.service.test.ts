import { FavoriteService } from '@/application/favorite.service';
import { Favorite } from '@/domain/entities/favorite.entity';
import {
  FavoriteAlreadyExistsException,
  FavoriteNotFoundException,
} from '@/domain/exceptions/domain.exception';
import type { FavoriteRepository } from '@/domain/repositories/favorite.repository';
import { randomUUID } from 'crypto';

const conductorId = randomUUID();
const vehicleId = randomUUID();

function makeFavorite(): Favorite {
  return new Favorite(randomUUID(), conductorId, vehicleId);
}

describe('FavoriteService', () => {
  let service: FavoriteService;
  let repoMock: jest.Mocked<FavoriteRepository>;

  beforeEach(() => {
    repoMock = {
      save: jest.fn(),
      delete: jest.fn(),
      findByConductor: jest.fn(),
      findByConductorAndVehicle: jest.fn(),
    };
    service = new FavoriteService(repoMock);
  });

  // ─── addFavorite ───────────────────────────────────────────────────────────

  describe('addFavorite', () => {
    it('guarda el favorito y retorna AddFavoriteResponse válido', async () => {
      repoMock.findByConductorAndVehicle.mockResolvedValue(null);
      const saved = makeFavorite();
      repoMock.save.mockResolvedValue(saved);

      const result = await service.addFavorite(conductorId, { vehicleId });

      expect(repoMock.save).toHaveBeenCalledWith(expect.any(Favorite));
      expect(result.id).toBe(saved.id);
      expect(result.vehicleId).toBe(vehicleId);
      expect(result.conductorId).toBe(conductorId);
      expect(typeof result.createdAt).toBe('string');
    });

    it('lanza FavoriteAlreadyExistsException si el favorito ya existe', async () => {
      repoMock.findByConductorAndVehicle.mockResolvedValue(makeFavorite());

      await expect(service.addFavorite(conductorId, { vehicleId })).rejects.toThrow(
        FavoriteAlreadyExistsException,
      );
      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('verifica la existencia antes de guardar', async () => {
      repoMock.findByConductorAndVehicle.mockResolvedValue(null);
      repoMock.save.mockResolvedValue(makeFavorite());

      await service.addFavorite(conductorId, { vehicleId });

      expect(repoMock.findByConductorAndVehicle).toHaveBeenCalledWith(
        conductorId,
        vehicleId,
      );
    });
  });

  // ─── removeFavorite ────────────────────────────────────────────────────────

  describe('removeFavorite', () => {
    it('elimina el favorito cuando existe', async () => {
      repoMock.findByConductorAndVehicle.mockResolvedValue(makeFavorite());
      repoMock.delete.mockResolvedValue(undefined);

      await service.removeFavorite(conductorId, vehicleId);

      expect(repoMock.delete).toHaveBeenCalledWith(conductorId, vehicleId);
    });

    it('lanza FavoriteNotFoundException si el favorito no existe', async () => {
      repoMock.findByConductorAndVehicle.mockResolvedValue(null);

      await expect(service.removeFavorite(conductorId, vehicleId)).rejects.toThrow(
        FavoriteNotFoundException,
      );
      expect(repoMock.delete).not.toHaveBeenCalled();
    });
  });

  // ─── listFavorites ─────────────────────────────────────────────────────────

  describe('listFavorites', () => {
    it('retorna lista vacía cuando el conductor no tiene favoritos', async () => {
      repoMock.findByConductor.mockResolvedValue([]);

      const result = await service.listFavorites(conductorId);

      expect(result.items).toHaveLength(0);
    });

    it('retorna los favoritos del conductor con forma válida', async () => {
      const fav1 = makeFavorite();
      const fav2 = new Favorite(randomUUID(), conductorId, randomUUID());
      repoMock.findByConductor.mockResolvedValue([fav1, fav2]);

      const result = await service.listFavorites(conductorId);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].vehicleId).toBe(fav1.vehicleId);
      expect(typeof result.items[0].createdAt).toBe('string');
    });

    it('solo retorna favoritos del conductor solicitado', async () => {
      repoMock.findByConductor.mockResolvedValue([makeFavorite()]);

      await service.listFavorites(conductorId);

      expect(repoMock.findByConductor).toHaveBeenCalledWith(conductorId);
    });
  });
});
