import { latLngToCell, cellToBoundary, polygonToCells } from 'h3-js';

/**
 * Resolución H3 usada en el motor de pricing y el admin map. Resolución 8
 * equivale a hexágonos de ~460m de diámetro: "zona / barrio chico" para CABA.
 */
export const H3_RESOLUTION = 8;

const CABA_POLYGON_LAT_LON: Array<[number, number]> = [
  [-34.5265, -58.5301],
  [-34.5290, -58.4530],
  [-34.5410, -58.4170],
  [-34.5550, -58.3850],
  [-34.5670, -58.3620],
  [-34.5990, -58.3360],
  [-34.6300, -58.3360],
  [-34.6500, -58.3540],
  [-34.6630, -58.3720],
  [-34.6790, -58.4020],
  [-34.6860, -58.4380],
  [-34.6850, -58.4780],
  [-34.6720, -58.5180],
  [-34.6420, -58.5320],
  [-34.6020, -58.5320],
  [-34.5640, -58.5260],
  [-34.5265, -58.5301],
];

const CABA_H3_CELLS = new Set(
  polygonToCells(CABA_POLYGON_LAT_LON, H3_RESOLUTION),
);

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

export function isH3CellInCaba(h3Cell: string): boolean {
  return CABA_H3_CELLS.has(h3Cell);
}
