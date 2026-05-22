/**
 * Helpers de clustering geográfico para el mapa de rentadoras.
 *
 * El nivel de agregación depende del zoom: a zoom bajo se devuelven pines de
 * zona (multi-rentadora); a zoom medio/alto, pines por (rentadora + celda), de
 * modo que autos de una misma rentadora en ubicaciones distintas terminan en
 * pines separados a medida que la celda se afina.
 */

export type ClusterMode = 'zone' | 'rentadora';

/** Zoom a partir del cual se separan los pines por rentadora. */
export const RENTADORA_ZOOM_THRESHOLD = 13;

export function zoomToClusterMode(zoom: number): ClusterMode {
  return zoom < RENTADORA_ZOOM_THRESHOLD ? 'zone' : 'rentadora';
}

/**
 * Tamaño de celda (en grados) para el grid de clustering. A más zoom, celda
 * más chica → ubicaciones cercanas se separan progresivamente.
 */
export function zoomToGridSizeDegrees(zoom: number): number {
  const clamped = Math.min(Math.max(zoom, 1), 22);
  return 360 / Math.pow(2, clamped);
}

/** Clave de celda del grid para una coordenada. */
export function cellKey(lat: number, lng: number, gridSize: number): string {
  const row = Math.floor(lat / gridSize);
  const col = Math.floor(lng / gridSize);
  return `${row}_${col}`;
}

/** Distancia Haversine en kilómetros entre dos coordenadas. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Bounding-box que circunscribe un círculo (centro + radio en km). */
export function boundingBoxForRadius(
  lat: number,
  lng: number,
  radiusKm: number,
): BoundingBox {
  const latDelta = radiusKm / 111;
  const lngDelta =
    radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return {
    north: Math.min(lat + latDelta, 90),
    south: Math.max(lat - latDelta, -90),
    east: Math.min(lng + lngDelta, 180),
    west: Math.max(lng - lngDelta, -180),
  };
}

/** Promedio simple de una lista de números (centroide por eje). */
export function centroid(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

/**
 * Separa marcadores que se solaparían visualmente distribuyéndolos en un
 * pequeño círculo alrededor del punto compartido. Sin esto, dos rentadoras en
 * la misma ubicación (o lo bastante cerca para que sus pines se pisen)
 * apilarían los marcadores y solo el de arriba sería clickeable.
 *
 * @param groupCellDeg  Tamaño de celda para detectar solapamiento. Debe
 *   derivarse del zoom (≈ el ancho de un pin en grados) para que la
 *   separación aparezca sin necesidad de acercar tanto el mapa.
 * @param fanRadiusDeg  Radio del círculo en el que se reparten los pines.
 */
export function fanOutOverlapping<
  T extends { latitude: number; longitude: number },
>(markers: T[], groupCellDeg: number, fanRadiusDeg: number): T[] {
  const groups = new Map<string, T[]>();
  for (const marker of markers) {
    const key = cellKey(marker.latitude, marker.longitude, groupCellDeg);
    const bucket = groups.get(key);
    if (bucket) bucket.push(marker);
    else groups.set(key, [marker]);
  }

  const result: T[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    const cx = centroid(group.map((m) => m.latitude));
    const cy = centroid(group.map((m) => m.longitude));
    // Corrige el eje longitudinal por la latitud para que el círculo no se
    // deforme demasiado lejos del ecuador.
    const lngScale = Math.max(Math.cos((cx * Math.PI) / 180), 0.01);
    group.forEach((marker, index) => {
      const angle = (2 * Math.PI * index) / group.length;
      result.push({
        ...marker,
        latitude: cx + fanRadiusDeg * Math.sin(angle),
        longitude: cy + (fanRadiusDeg / lngScale) * Math.cos(angle),
      });
    });
  }
  return result;
}
