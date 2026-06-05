import { latLngToCell, cellToBoundary } from 'h3-js';

/**
 * Resolución H3 usada en el motor de pricing y el admin map. Resolución 8
 * equivale a hexágonos de ~460m de diámetro: "zona / barrio chico" para CABA.
 */
export const H3_RESOLUTION = 8;

/**
 * Convierte coordenadas geográficas a una celda H3 a la resolución `H3_RESOLUTION`.
 * Devuelve `null` si las coordenadas son inválidas o nulas.
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
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  return latLngToCell(latitude, longitude, resolution);
}

/**
 * Devuelve el polígono GeoJSON (anillo cerrado, en formato `[lon, lat]`) que
 * representa el contorno de la celda H3. Compatible con MapLibre.
 */
export function h3CellToGeoJsonPolygon(h3Cell: string): {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>;
} {
  const boundary = cellToBoundary(h3Cell, true);
  const ring: Array<[number, number]> = boundary.map(([lng, lat]) => [lng, lat]);
  if (ring.length > 0) {
    ring.push(ring[0]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}
