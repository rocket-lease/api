export interface LocationRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  cityName: string | null;
  centerLat: number | null;
  centerLng: number | null;
}

export interface LocationSeed {
  code: string;
  name: string;
  type: string;
  parentCode?: string;
  provinceCode?: string;
  cityName?: string;
  displayOrder: number;
  center?: { latitude: number; longitude: number };
}

export interface LocationH3CellSeed {
  h3Cell: string;
  weight: number;
}

export interface LocationGeometrySeed {
  geometry: object;
  source: string;
  version: string;
}

export interface LocationRepository {
  /**
   * Lista las ubicaciones habilitadas, ordenadas por displayOrder y nombre.
   */
  findAllEnabled(): Promise<LocationRecord[]>;

  /**
   * Busca una ubicación habilitada por su código. Devuelve `null` si no
   * existe o está deshabilitada.
   */
  findEnabledByCode(code: string): Promise<LocationRecord | null>;

  /**
   * Crea o actualiza una ubicación del catálogo de búsqueda; si estaba
   * deshabilitada la re-habilita.
   */
  upsertLocation(seed: LocationSeed): Promise<void>;

  /**
   * Reemplaza atómicamente la cobertura H3 de una ubicación (y, si se pasa,
   * la geometría fuente). Borrar y recrear garantiza que no queden celdas
   * viejas con pesos desnormalizados cuando cambia el dataset o la
   * resolución.
   */
  replaceCoverage(
    locationId: string,
    cells: LocationH3CellSeed[],
    geometry?: LocationGeometrySeed,
  ): Promise<void>;
}

export const LOCATION_REPOSITORY = Symbol('LocationRepository');
