/* eslint-disable @typescript-eslint/no-require-imports */

export interface CabaNeighborhoodFeature {
  properties: { nombre: string };
  geometry: { type: string; coordinates: unknown };
}

/**
 * Dataset oficial de barrios de CABA (GCBA Datos Abiertos), versionado como
 * asset del bundle: webpack/jest lo resuelven en build-time, sin fetch en
 * runtime.
 * https://cdn.buenosaires.gob.ar/datosabiertos/datasets/ministerio-de-educacion/barrios/barrios.geojson
 */
export const CABA_NEIGHBORHOODS_GEOJSON: {
  features: CabaNeighborhoodFeature[];
} = require('./caba-neighborhoods.json');

export const CABA_GEOJSON_SOURCE = 'GCBA Datos Abiertos - Barrios de CABA';
export const CABA_GEOJSON_VERSION = '2024';
