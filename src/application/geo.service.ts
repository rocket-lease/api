import { Inject, Injectable } from '@nestjs/common';
import {
  MapSearchRequest,
  MapSearchResponse,
  MapSearchResponseSchema,
  MapMarker,
} from '@rocket-lease/contracts';
import {
  GEO_REPOSITORY,
  type GeoRepository,
  type GeoSearchArea,
  type GeoVehicle,
} from '@/domain/repositories/geo.repository';
import {
  USER_REPOSITORY,
  type UserProfile,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { InvalidMapBoundsException } from '@/domain/exceptions/geo.exception';
import {
  boundingBoxForRadius,
  cellKey,
  centroid,
  fanOutOverlapping,
  haversineKm,
  zoomToClusterMode,
  zoomToGridSizeDegrees,
  type BoundingBox,
} from './helpers/geo-cluster';

@Injectable()
export class GeoService {
  constructor(
    @Inject(GEO_REPOSITORY) private readonly geoRepository: GeoRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  public async searchRentadoras(
    request: MapSearchRequest,
  ): Promise<MapSearchResponse> {
    const bbox = this.resolveBoundingBox(request);

    const area: GeoSearchArea = {
      north: bbox.north,
      south: bbox.south,
      east: bbox.east,
      west: bbox.west,
      transmission: request.transmission,
      maxPriceDailyCents:
        request.maxPriceDaily !== undefined
          ? request.maxPriceDaily * 100
          : undefined,
      characteristics: request.characteristics,
      isAccessible: request.isAccessible,
      from: request.from,
      to: request.to,
    };

    let vehicles = await this.geoRepository.findAvailableVehiclesInArea(area);

    // "Cerca de mí": el bbox circunscribe el círculo, recortamos por distancia.
    if (request.center && request.radiusKm !== undefined) {
      const { latitude, longitude } = request.center;
      const radiusKm = request.radiusKm;
      vehicles = vehicles.filter(
        (v) =>
          haversineKm(latitude, longitude, v.latitude, v.longitude) <=
          radiusKm,
      );
    }

    const markers =
      zoomToClusterMode(request.zoom) === 'zone'
        ? this.buildZoneMarkers(vehicles, request.zoom)
        : await this.buildRentadoraMarkers(vehicles, request.zoom);

    return MapSearchResponseSchema.parse({ markers });
  }

  private resolveBoundingBox(request: MapSearchRequest): BoundingBox {
    if (request.bounds) {
      const { north, south, east, west } = request.bounds;
      if (north < south) {
        throw new InvalidMapBoundsException('north must be >= south');
      }
      return { north, south, east, west };
    }
    if (request.center && request.radiusKm !== undefined) {
      return boundingBoxForRadius(
        request.center.latitude,
        request.center.longitude,
        request.radiusKm,
      );
    }
    throw new InvalidMapBoundsException('bounds or center+radiusKm required');
  }

  /** Zoom bajo: un pin de zona por celda, agrupando todas las rentadoras. */
  private buildZoneMarkers(
    vehicles: GeoVehicle[],
    zoom: number,
  ): MapMarker[] {
    const grid = zoomToGridSizeDegrees(zoom);
    const cells = new Map<string, GeoVehicle[]>();
    for (const v of vehicles) {
      const key = cellKey(v.latitude, v.longitude, grid);
      const bucket = cells.get(key);
      if (bucket) bucket.push(v);
      else cells.set(key, [v]);
    }

    const markers: MapMarker[] = [];
    for (const [key, group] of cells) {
      const owners = new Set(group.map((v) => v.ownerId));
      markers.push({
        type: 'zone',
        clusterId: `z-${zoom}-${key}`,
        latitude: centroid(group.map((v) => v.latitude)),
        longitude: centroid(group.map((v) => v.longitude)),
        vehicleCount: group.length,
        rentadoraCount: owners.size,
        minPriceCents: Math.min(...group.map((v) => v.basePriceCents)),
        currency: 'ARS',
      });
    }
    return markers;
  }

  /** Zoom medio/alto: un pin por (celda, rentadora). */
  private async buildRentadoraMarkers(
    vehicles: GeoVehicle[],
    zoom: number,
  ): Promise<MapMarker[]> {
    const grid = zoomToGridSizeDegrees(zoom);
    const groups = new Map<string, GeoVehicle[]>();
    for (const v of vehicles) {
      const key = `${cellKey(v.latitude, v.longitude, grid)}|${v.ownerId}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(v);
      else groups.set(key, [v]);
    }

    const ownerIds = Array.from(new Set(vehicles.map((v) => v.ownerId)));
    const profiles = await this.userRepository.findProfilesByIds(ownerIds);
    const profileById = new Map<string, UserProfile>(
      profiles.map((p) => [p.id, p]),
    );

    const markers: MapMarker[] = [];
    for (const [key, group] of groups) {
      const ownerId = group[0].ownerId;
      const profile = profileById.get(ownerId);
      if (!profile) continue;
      markers.push({
        type: 'rentadora',
        clusterId: `r-${zoom}-${key}`,
        latitude: centroid(group.map((v) => v.latitude)),
        longitude: centroid(group.map((v) => v.longitude)),
        rentadorId: ownerId,
        rentadorName: profile.name,
        availableVehicleCount: group.length,
        minPriceCents: Math.min(...group.map((v) => v.basePriceCents)),
        currency: 'ARS',
        reputationScore: profile.reputationScore,
        level: profile.level,
        verified: profile.verificationStatus === 'verified',
      });
    }
    // Distintas rentadoras en la misma ubicación (o tan cerca que sus pines
    // se pisarían al zoom actual): se abren en abanico para que todos sean
    // seleccionables. La celda de detección se deriva del zoom ≈ el ancho de
    // un pin, así la separación aparece sin tener que acercar tanto el mapa.
    return fanOutOverlapping(markers, grid * 0.3, grid * 0.22);
  }
}
