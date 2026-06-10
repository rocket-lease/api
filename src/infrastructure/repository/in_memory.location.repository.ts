import type {
  LocationGeometrySeed,
  LocationH3CellSeed,
  LocationRecord,
  LocationRepository,
  LocationSeed,
} from '@/domain/repositories/location.repository';

interface StoredLocation extends LocationRecord {
  displayOrder: number;
  enabled: boolean;
}

export class InMemoryLocationRepository implements LocationRepository {
  private readonly locations = new Map<string, StoredLocation>();
  public readonly cellsByLocation = new Map<string, LocationH3CellSeed[]>();
  public readonly geometryByLocation = new Map<string, LocationGeometrySeed>();

  public async findAllEnabled(): Promise<LocationRecord[]> {
    return Array.from(this.locations.values())
      .filter((location) => location.enabled)
      .sort(
        (left, right) =>
          left.displayOrder - right.displayOrder ||
          left.name.localeCompare(right.name),
      )
      .map((location) => this.mapRecord(location));
  }

  public async findEnabledByCode(code: string): Promise<LocationRecord | null> {
    const location = Array.from(this.locations.values()).find(
      (candidate) => candidate.code === code && candidate.enabled,
    );
    return location ? this.mapRecord(location) : null;
  }

  public async upsertLocation(seed: LocationSeed): Promise<void> {
    this.locations.set(seed.code, {
      id: seed.code,
      code: seed.code,
      name: seed.name,
      type: seed.type,
      parentId: seed.parentCode ?? null,
      cityName: seed.cityName ?? null,
      centerLat: seed.center?.latitude ?? null,
      centerLng: seed.center?.longitude ?? null,
      displayOrder: seed.displayOrder,
      enabled: true,
    });
  }

  public async replaceCoverage(
    locationId: string,
    cells: LocationH3CellSeed[],
    geometry?: LocationGeometrySeed,
  ): Promise<void> {
    this.cellsByLocation.set(locationId, [...cells]);
    if (geometry) {
      this.geometryByLocation.set(locationId, geometry);
    }
  }

  private mapRecord(location: StoredLocation): LocationRecord {
    return {
      id: location.id,
      code: location.code,
      name: location.name,
      type: location.type,
      parentId: location.parentId,
      cityName: location.cityName,
      centerLat: location.centerLat,
      centerLng: location.centerLng,
    };
  }
}
