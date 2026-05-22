import { Characteristic } from '@rocket-lease/contracts';

/** Proyección liviana de un vehículo para construir marcadores del mapa. */
export interface GeoVehicle {
  id: string;
  ownerId: string;
  brand: string;
  model: string;
  year: number;
  basePriceCents: number;
  latitude: number;
  longitude: number;
  photo: string | null;
}

/** Área + filtros que recibe el repositorio para buscar vehículos. */
export interface GeoSearchArea {
  /** Bounding-box (para "Cerca de mí" el service circunscribe el círculo). */
  north: number;
  south: number;
  east: number;
  west: number;
  transmission?: 'Manual' | 'Automatico' | 'Semiautomatico';
  maxPriceDailyCents?: number;
  characteristics?: Characteristic[];
  isAccessible?: boolean;
  /** Rango de disponibilidad (ISO datetime). */
  from?: string;
  to?: string;
}

export interface GeoRepository {
  /**
   * Vehículos habilitados, con coordenadas, disponibles dentro del
   * bounding-box y que cumplen los filtros.
   */
  findAvailableVehiclesInArea(area: GeoSearchArea): Promise<GeoVehicle[]>;
}

export const GEO_REPOSITORY = Symbol('GeoRepository');
