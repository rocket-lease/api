import { latLngToCell, cellToBoundary, polygonToCells } from 'h3-js';
import { CABA_NEIGHBORHOODS_GEOJSON } from '../geo/caba-geojson';

/**
 * Resolución H3 usada en el motor de pricing y el admin map. Resolución 8
 * equivale a hexágonos de ~460m de diámetro: "zona / barrio chico" para CABA.
 */
export const H3_RESOLUTION = 8;

/**
 * Convierte una geometría GeoJSON (Polygon o MultiPolygon) a un array de
 * celdas H3 a la resolución `H3_RESOLUTION`. Se pasan todos los anillos a
 * h3-js (`isGeoJson: true` interpreta las coordenadas [lon, lat] tal cual),
 * de modo que los huecos del polígono quedan excluidos de la cobertura.
 */
export function getH3CellsForGeometry(geometry: {
  type: string;
  coordinates: unknown;
}): string[] {
  if (geometry.type === 'Polygon') {
    return polygonToCells(
      geometry.coordinates as number[][][],
      H3_RESOLUTION,
      true,
    );
  }
  if (geometry.type === 'MultiPolygon') {
    const cells = new Set<string>();
    for (const polygon of geometry.coordinates as number[][][][]) {
      for (const cell of polygonToCells(polygon, H3_RESOLUTION, true)) {
        cells.add(cell);
      }
    }
    return Array.from(cells);
  }
  return [];
}

/**
 * Grilla H3 de CABA: unión de las celdas de los 48 polígonos oficiales de
 * barrios. Derivarla del mismo dataset que la cobertura por barrio garantiza
 * que ningún barrio pierda celdas frente a un contorno dibujado aparte y que
 * la grilla no incluya celdas de agua o puerto.
 */
const CABA_H3_CELLS = new Set<string>(
  CABA_NEIGHBORHOODS_GEOJSON.features.flatMap((feature) =>
    getH3CellsForGeometry(feature.geometry),
  ),
);

export const CABA_H3_CELL_LIST = Array.from(CABA_H3_CELLS);

export function isH3CellInCaba(h3Cell: string): boolean {
  return CABA_H3_CELLS.has(h3Cell);
}

/**
 * Convierte coordenadas geográficas a una celda H3 a la resolución
 * `H3_RESOLUTION`. Devuelve `null` si las coordenadas son nulas, no finitas
 * o están fuera del rango geográfico válido.
 */
export function latLonToH3(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  resolution: number = H3_RESOLUTION,
): string | null {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return latLngToCell(latitude, longitude, resolution);
}

/**
 * Devuelve el polígono GeoJSON (en formato `[lon, lat]`) que representa el
 * contorno de la celda H3. `cellToBoundary` con `formatAsGeoJson` ya entrega
 * el anillo cerrado (primer y último vértice iguales), apto para MapLibre.
 */
export function h3CellToGeoJsonPolygon(h3Cell: string): {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>;
} {
  const ring = cellToBoundary(h3Cell, true).map(
    ([lng, lat]) => [lng, lat] as [number, number],
  );
  return { type: 'Polygon', coordinates: [ring] };
}
