import { GeoLocationService } from '@/application/geo-location.service';
import { InMemoryLocationRepository } from '@/infrastructure/repository/in_memory.location.repository';

describe('GeoLocationService seeding', () => {
  it('siembra el catálogo y arma el árbol ciudad → barrios', async () => {
    const repository = new InMemoryLocationRepository();
    const service = new GeoLocationService(repository);

    const locations = await service.listSearchLocations();

    const caba = locations.find((location) => location.code === 'caba');
    expect(caba).toBeDefined();
    expect(caba?.children?.length).toBe(48);
    expect(locations.every((location) => location.parentCode === undefined)).toBe(
      true,
    );
  });

  it('cada ubicación con cobertura suma peso ≈ 1.0', async () => {
    const repository = new InMemoryLocationRepository();
    const service = new GeoLocationService(repository);

    await service.listSearchLocations();

    expect(repository.cellsByLocation.size).toBe(49);
    for (const [locationId, cells] of repository.cellsByLocation) {
      expect(cells.length).toBeGreaterThan(1);
      const total = cells.reduce((sum, cell) => sum + cell.weight, 0);
      expect({ locationId, total }).toEqual({
        locationId,
        total: expect.closeTo(1.0, 5) as number,
      });
    }
  });

  it('persiste la geometría fuente de cada barrio', async () => {
    const repository = new InMemoryLocationRepository();
    const service = new GeoLocationService(repository);

    await service.listSearchLocations();

    expect(repository.geometryByLocation.size).toBe(48);
    expect(repository.geometryByLocation.get('caba-belgrano')?.source).toContain(
      'GCBA',
    );
  });

  it('reintenta el seed si el primer intento falla', async () => {
    const repository = new InMemoryLocationRepository();
    const originalUpsert = repository.upsertLocation.bind(repository);
    let failNext = true;
    repository.upsertLocation = async (seed) => {
      if (failNext) {
        failNext = false;
        throw new Error('db down');
      }
      return originalUpsert(seed);
    };
    const service = new GeoLocationService(repository);

    await expect(service.listSearchLocations()).rejects.toThrow('db down');

    const locations = await service.listSearchLocations();
    expect(locations.find((location) => location.code === 'caba')).toBeDefined();
  });
});
