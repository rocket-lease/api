import { GeoService } from '@/application/geo.service';
import type {
  GeoRepository,
  GeoVehicle,
} from '@/domain/repositories/geo.repository';
import type {
  UserProfile,
  UserRepository,
} from '@/domain/repositories/user.repository';
import { InvalidMapBoundsException } from '@/domain/exceptions/geo.exception';
import { randomUUID } from 'crypto';

const OWNER_A = randomUUID();
const OWNER_B = randomUUID();

const bounds = { north: -34, south: -35, east: -58, west: -59 };

function vehicle(over: Partial<GeoVehicle>): GeoVehicle {
  return {
    id: randomUUID(),
    ownerId: OWNER_A,
    brand: 'Toyota',
    model: 'Yaris',
    year: 2021,
    basePriceCents: 500000,
    latitude: -34.6,
    longitude: -58.4,
    photo: null,
    ...over,
  };
}

function profile(id: string, name: string): UserProfile {
  return {
    id,
    name,
    email: `${name}@example.com`,
    phone: '123',
    avatarUrl: null,
    verificationStatus: 'verified',
    level: 'gold',
    reputationScore: 4.5,
    balanceInCents: 0,
    preferences: { transmission: null, accessibility: [], maxPriceDaily: null },
    autoAccept: false,
  };
}

describe('GeoService', () => {
  let geoRepo: jest.Mocked<GeoRepository>;
  let userRepo: jest.Mocked<Pick<UserRepository, 'findProfilesByIds'>>;
  let service: GeoService;

  beforeEach(() => {
    geoRepo = { findAvailableVehiclesInArea: jest.fn() };
    userRepo = { findProfilesByIds: jest.fn().mockResolvedValue([]) };
    service = new GeoService(
      geoRepo,
      userRepo as unknown as UserRepository,
    );
  });

  it('rechaza bounds inválidos (north < south)', async () => {
    await expect(
      service.searchRentadoras({
        bounds: { north: -35, south: -34, east: -58, west: -59 },
        zoom: 12,
      }),
    ).rejects.toBeInstanceOf(InvalidMapBoundsException);
  });

  it('a zoom bajo agrupa varias rentadoras en un pin de zona', async () => {
    geoRepo.findAvailableVehiclesInArea.mockResolvedValue([
      vehicle({ ownerId: OWNER_A, latitude: -34.6, longitude: -58.4 }),
      vehicle({ ownerId: OWNER_B, latitude: -34.61, longitude: -58.41 }),
    ]);

    const res = await service.searchRentadoras({ bounds, zoom: 5 });

    expect(res.markers).toHaveLength(1);
    const marker = res.markers[0];
    expect(marker.type).toBe('zone');
    if (marker.type === 'zone') {
      expect(marker.vehicleCount).toBe(2);
      expect(marker.rentadoraCount).toBe(2);
    }
  });

  it('a zoom alto separa pines por rentadora', async () => {
    geoRepo.findAvailableVehiclesInArea.mockResolvedValue([
      vehicle({ ownerId: OWNER_A, latitude: -34.6, longitude: -58.4 }),
      vehicle({ ownerId: OWNER_B, latitude: -34.6, longitude: -58.4 }),
    ]);
    userRepo.findProfilesByIds.mockResolvedValue([
      profile(OWNER_A, 'AutosA'),
      profile(OWNER_B, 'AutosB'),
    ]);

    const res = await service.searchRentadoras({ bounds, zoom: 16 });

    expect(res.markers).toHaveLength(2);
    expect(res.markers.every((m) => m.type === 'rentadora')).toBe(true);
  });

  it('separa autos de una misma rentadora en ubicaciones distintas', async () => {
    geoRepo.findAvailableVehiclesInArea.mockResolvedValue([
      vehicle({ ownerId: OWNER_A, latitude: -34.60, longitude: -58.40 }),
      vehicle({ ownerId: OWNER_A, latitude: -34.95, longitude: -58.95 }),
    ]);
    userRepo.findProfilesByIds.mockResolvedValue([profile(OWNER_A, 'AutosA')]);

    const res = await service.searchRentadoras({ bounds, zoom: 18 });

    expect(res.markers).toHaveLength(2);
    expect(res.markers.every((m) => m.type === 'rentadora')).toBe(true);
  });

  it('separa los pines de dos rentadoras en la misma ubicación', async () => {
    geoRepo.findAvailableVehiclesInArea.mockResolvedValue([
      vehicle({ ownerId: OWNER_A, latitude: -34.6, longitude: -58.4 }),
      vehicle({ ownerId: OWNER_B, latitude: -34.6, longitude: -58.4 }),
    ])
    userRepo.findProfilesByIds.mockResolvedValue([
      profile(OWNER_A, 'AutosA'),
      profile(OWNER_B, 'AutosB'),
    ])

    const res = await service.searchRentadoras({ bounds, zoom: 16 })

    expect(res.markers).toHaveLength(2)
    const [a, b] = res.markers
    expect(a.latitude === b.latitude && a.longitude === b.longitude).toBe(
      false,
    )
  })

  it('"Cerca de mí" descarta vehículos fuera del radio', async () => {
    geoRepo.findAvailableVehiclesInArea.mockResolvedValue([
      vehicle({ ownerId: OWNER_A, latitude: -34.60, longitude: -58.40 }),
      vehicle({ ownerId: OWNER_A, latitude: -34.95, longitude: -58.95 }),
    ]);

    const res = await service.searchRentadoras({
      center: { latitude: -34.6, longitude: -58.4 },
      radiusKm: 5,
      zoom: 5,
    });

    expect(res.markers).toHaveLength(1);
    const marker = res.markers[0];
    if (marker.type === 'zone') {
      expect(marker.vehicleCount).toBe(1);
    }
  });
});
