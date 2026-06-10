import { Inject, Injectable } from '@nestjs/common';
import type { GeoLocationOption } from '@rocket-lease/contracts';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  CABA_H3_CELL_LIST,
  getH3CellsForGeometry,
  isH3CellInCaba,
} from './helpers/h3';

/* eslint-disable @typescript-eslint/no-require-imports */
const CABA_NEIGHBORHOODS_GEOJSON: {
  features: Array<{ properties: { nombre: string }; geometry: { type: string; coordinates: unknown } }>;
} = require('./geo/caba-neighborhoods.geojson');

/**
 * Fuente: GCBA Datos Abiertos — "Barrios de la Ciudad Autónoma de Buenos Aires"
 * https://cdn.buenosaires.gob.ar/datosabiertos/datasets/ministerio-de-educacion/barrios/barrios.geojson
 * Mapeo explícito de código interno → nombre en el GeoJSON oficial (campo "nombre").
 * Necesario donde el GeoJSON difiere: Monserrat, Paternal, Villa Del Parque, Villa Gral. Mitre.
 */
const NEIGHBORHOOD_GEOJSON_NAME: Record<string, string> = {
  'caba-agronomia': 'Agronomia',
  'caba-almagro': 'Almagro',
  'caba-balvanera': 'Balvanera',
  'caba-barracas': 'Barracas',
  'caba-belgrano': 'Belgrano',
  'caba-boedo': 'Boedo',
  'caba-caballito': 'Caballito',
  'caba-chacarita': 'Chacarita',
  'caba-coghlan': 'Coghlan',
  'caba-colegiales': 'Colegiales',
  'caba-constitucion': 'Constitucion',
  'caba-flores': 'Flores',
  'caba-floresta': 'Floresta',
  'caba-la-boca': 'La Boca',
  'caba-la-paternal': 'Paternal',
  'caba-liniers': 'Liniers',
  'caba-mataderos': 'Mataderos',
  'caba-monte-castro': 'Monte Castro',
  'caba-montserrat': 'Monserrat',
  'caba-nueva-pompeya': 'Nueva Pompeya',
  'caba-nunez': 'Nuñez',
  'caba-palermo': 'Palermo',
  'caba-parque-avellaneda': 'Parque Avellaneda',
  'caba-parque-chacabuco': 'Parque Chacabuco',
  'caba-parque-chas': 'Parque Chas',
  'caba-parque-patricios': 'Parque Patricios',
  'caba-puerto-madero': 'Puerto Madero',
  'caba-recoleta': 'Recoleta',
  'caba-retiro': 'Retiro',
  'caba-saavedra': 'Saavedra',
  'caba-san-cristobal': 'San Cristobal',
  'caba-san-nicolas': 'San Nicolas',
  'caba-san-telmo': 'San Telmo',
  'caba-velez-sarsfield': 'Velez Sarsfield',
  'caba-versalles': 'Versalles',
  'caba-villa-crespo': 'Villa Crespo',
  'caba-villa-del-parque': 'Villa Del Parque',
  'caba-villa-devoto': 'Villa Devoto',
  'caba-villa-general-mitre': 'Villa Gral. Mitre',
  'caba-villa-lugano': 'Villa Lugano',
  'caba-villa-luro': 'Villa Luro',
  'caba-villa-ortuzar': 'Villa Ortuzar',
  'caba-villa-pueyrredon': 'Villa Pueyrredon',
  'caba-villa-real': 'Villa Real',
  'caba-villa-riachuelo': 'Villa Riachuelo',
  'caba-villa-santa-rita': 'Villa Santa Rita',
  'caba-villa-soldati': 'Villa Soldati',
  'caba-villa-urquiza': 'Villa Urquiza',
};

const GEOJSON_FEATURE_BY_NAME = new Map(
  CABA_NEIGHBORHOODS_GEOJSON.features.map((f) => [f.properties.nombre, f]),
);

interface SeedLocation {
  code: string;
  name: string;
  type: 'city' | 'neighborhood';
  parentCode?: string;
  provinceCode?: string;
  cityName?: string;
  displayOrder: number;
  center?: { latitude: number; longitude: number };
}

const CITY_LOCATIONS: SeedLocation[] = [
  {
    code: 'caba',
    name: 'CABA',
    type: 'city',
    provinceCode: 'C',
    cityName: 'CABA',
    displayOrder: 0,
    center: { latitude: -34.6037, longitude: -58.3816 },
  },
  {
    code: 'bariloche',
    name: 'Bariloche',
    type: 'city',
    provinceCode: 'R',
    cityName: 'Bariloche',
    displayOrder: 10,
    center: { latitude: -41.1335, longitude: -71.3103 },
  },
  {
    code: 'mar-del-plata',
    name: 'Mar del Plata',
    type: 'city',
    provinceCode: 'B',
    cityName: 'Mar del Plata',
    displayOrder: 20,
    center: { latitude: -38.0055, longitude: -57.5426 },
  },
  {
    code: 'mendoza',
    name: 'Mendoza',
    type: 'city',
    provinceCode: 'M',
    cityName: 'Mendoza',
    displayOrder: 30,
    center: { latitude: -32.8895, longitude: -68.8458 },
  },
  {
    code: 'cordoba',
    name: 'Cordoba',
    type: 'city',
    provinceCode: 'X',
    cityName: 'Cordoba',
    displayOrder: 40,
    center: { latitude: -31.4201, longitude: -64.1888 },
  },
  {
    code: 'salta',
    name: 'Salta',
    type: 'city',
    provinceCode: 'A',
    cityName: 'Salta',
    displayOrder: 50,
    center: { latitude: -24.7821, longitude: -65.4232 },
  },
  {
    code: 'rosario',
    name: 'Rosario',
    type: 'city',
    provinceCode: 'S',
    cityName: 'Rosario',
    displayOrder: 60,
    center: { latitude: -32.9442, longitude: -60.6505 },
  },
  {
    code: 'san-martin-de-los-andes',
    name: 'San Martin de los Andes',
    type: 'city',
    provinceCode: 'Q',
    cityName: 'San Martin de los Andes',
    displayOrder: 70,
    center: { latitude: -40.1579, longitude: -71.3534 },
  },
];

const CABA_NEIGHBORHOODS: Array<
  Omit<SeedLocation, 'type' | 'parentCode' | 'provinceCode' | 'cityName'>
> = [
  { code: 'caba-agronomia', name: 'Agronomia', displayOrder: 101, center: { latitude: -34.5926, longitude: -58.4916 } },
  { code: 'caba-almagro', name: 'Almagro', displayOrder: 102, center: { latitude: -34.6099, longitude: -58.4211 } },
  { code: 'caba-balvanera', name: 'Balvanera', displayOrder: 103, center: { latitude: -34.6092, longitude: -58.4050 } },
  { code: 'caba-barracas', name: 'Barracas', displayOrder: 104, center: { latitude: -34.6460, longitude: -58.3843 } },
  { code: 'caba-belgrano', name: 'Belgrano', displayOrder: 105, center: { latitude: -34.5621, longitude: -58.4567 } },
  { code: 'caba-boedo', name: 'Boedo', displayOrder: 106, center: { latitude: -34.6305, longitude: -58.4170 } },
  { code: 'caba-caballito', name: 'Caballito', displayOrder: 107, center: { latitude: -34.6180, longitude: -58.4419 } },
  { code: 'caba-chacarita', name: 'Chacarita', displayOrder: 108, center: { latitude: -34.5880, longitude: -58.4540 } },
  { code: 'caba-coghlan', name: 'Coghlan', displayOrder: 109, center: { latitude: -34.5605, longitude: -58.4743 } },
  { code: 'caba-colegiales', name: 'Colegiales', displayOrder: 110, center: { latitude: -34.5737, longitude: -58.4502 } },
  { code: 'caba-constitucion', name: 'Constitucion', displayOrder: 111, center: { latitude: -34.6276, longitude: -58.3842 } },
  { code: 'caba-flores', name: 'Flores', displayOrder: 112, center: { latitude: -34.6280, longitude: -58.4639 } },
  { code: 'caba-floresta', name: 'Floresta', displayOrder: 113, center: { latitude: -34.6288, longitude: -58.4830 } },
  { code: 'caba-la-boca', name: 'La Boca', displayOrder: 114, center: { latitude: -34.6345, longitude: -58.3631 } },
  { code: 'caba-la-paternal', name: 'La Paternal', displayOrder: 115, center: { latitude: -34.5979, longitude: -58.4703 } },
  { code: 'caba-liniers', name: 'Liniers', displayOrder: 116, center: { latitude: -34.6442, longitude: -58.5198 } },
  { code: 'caba-mataderos', name: 'Mataderos', displayOrder: 117, center: { latitude: -34.6580, longitude: -58.5020 } },
  { code: 'caba-monte-castro', name: 'Monte Castro', displayOrder: 118, center: { latitude: -34.6187, longitude: -58.5055 } },
  { code: 'caba-montserrat', name: 'Montserrat', displayOrder: 119, center: { latitude: -34.6125, longitude: -58.3806 } },
  { code: 'caba-nueva-pompeya', name: 'Nueva Pompeya', displayOrder: 120, center: { latitude: -34.6501, longitude: -58.4206 } },
  { code: 'caba-nunez', name: 'Nunez', displayOrder: 121, center: { latitude: -34.5469, longitude: -58.4637 } },
  { code: 'caba-palermo', name: 'Palermo', displayOrder: 122, center: { latitude: -34.5889, longitude: -58.4306 } },
  { code: 'caba-parque-avellaneda', name: 'Parque Avellaneda', displayOrder: 123, center: { latitude: -34.6480, longitude: -58.4775 } },
  { code: 'caba-parque-chacabuco', name: 'Parque Chacabuco', displayOrder: 124, center: { latitude: -34.6355, longitude: -58.4383 } },
  { code: 'caba-parque-chas', name: 'Parque Chas', displayOrder: 125, center: { latitude: -34.5840, longitude: -58.4790 } },
  { code: 'caba-parque-patricios', name: 'Parque Patricios', displayOrder: 126, center: { latitude: -34.6377, longitude: -58.4010 } },
  { code: 'caba-puerto-madero', name: 'Puerto Madero', displayOrder: 127, center: { latitude: -34.6118, longitude: -58.3626 } },
  { code: 'caba-recoleta', name: 'Recoleta', displayOrder: 128, center: { latitude: -34.5883, longitude: -58.3975 } },
  { code: 'caba-retiro', name: 'Retiro', displayOrder: 129, center: { latitude: -34.5910, longitude: -58.3744 } },
  { code: 'caba-saavedra', name: 'Saavedra', displayOrder: 130, center: { latitude: -34.5529, longitude: -58.4863 } },
  { code: 'caba-san-cristobal', name: 'San Cristobal', displayOrder: 131, center: { latitude: -34.6234, longitude: -58.4045 } },
  { code: 'caba-san-nicolas', name: 'San Nicolas', displayOrder: 132, center: { latitude: -34.6037, longitude: -58.3816 } },
  { code: 'caba-san-telmo', name: 'San Telmo', displayOrder: 133, center: { latitude: -34.6210, longitude: -58.3731 } },
  { code: 'caba-velez-sarsfield', name: 'Velez Sarsfield', displayOrder: 134, center: { latitude: -34.6310, longitude: -58.4931 } },
  { code: 'caba-versalles', name: 'Versalles', displayOrder: 135, center: { latitude: -34.6289, longitude: -58.5226 } },
  { code: 'caba-villa-crespo', name: 'Villa Crespo', displayOrder: 136, center: { latitude: -34.5981, longitude: -58.4396 } },
  { code: 'caba-villa-del-parque', name: 'Villa del Parque', displayOrder: 137, center: { latitude: -34.6047, longitude: -58.4904 } },
  { code: 'caba-villa-devoto', name: 'Villa Devoto', displayOrder: 138, center: { latitude: -34.6006, longitude: -58.5148 } },
  { code: 'caba-villa-general-mitre', name: 'Villa General Mitre', displayOrder: 139, center: { latitude: -34.6108, longitude: -58.4683 } },
  { code: 'caba-villa-lugano', name: 'Villa Lugano', displayOrder: 140, center: { latitude: -34.6740, longitude: -58.4768 } },
  { code: 'caba-villa-luro', name: 'Villa Luro', displayOrder: 141, center: { latitude: -34.6376, longitude: -58.5027 } },
  { code: 'caba-villa-ortuzar', name: 'Villa Ortuzar', displayOrder: 142, center: { latitude: -34.5803, longitude: -58.4689 } },
  { code: 'caba-villa-pueyrredon', name: 'Villa Pueyrredon', displayOrder: 143, center: { latitude: -34.5810, longitude: -58.5055 } },
  { code: 'caba-villa-real', name: 'Villa Real', displayOrder: 144, center: { latitude: -34.6197, longitude: -58.5251 } },
  { code: 'caba-villa-riachuelo', name: 'Villa Riachuelo', displayOrder: 145, center: { latitude: -34.6903, longitude: -58.4718 } },
  { code: 'caba-villa-santa-rita', name: 'Villa Santa Rita', displayOrder: 146, center: { latitude: -34.6155, longitude: -58.4840 } },
  { code: 'caba-villa-soldati', name: 'Villa Soldati', displayOrder: 147, center: { latitude: -34.6652, longitude: -58.4457 } },
  { code: 'caba-villa-urquiza', name: 'Villa Urquiza', displayOrder: 148, center: { latitude: -34.5735, longitude: -58.4911 } },
];

const SEARCH_LOCATIONS: SeedLocation[] = [
  ...CITY_LOCATIONS,
  ...CABA_NEIGHBORHOODS.map((location) => ({
    ...location,
    type: 'neighborhood' as const,
    parentCode: 'caba',
    provinceCode: 'C',
    cityName: 'CABA',
  })),
];

const GEOJSON_SOURCE = 'GCBA Datos Abiertos - Barrios de CABA';
const GEOJSON_VERSION = '2024';

@Injectable()
export class GeoLocationService {
  private seedPromise: Promise<void> | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async listSearchLocations(): Promise<GeoLocationOption[]> {
    await this.ensureSeeded();
    const rows = await this.prisma.location.findMany({
      where: { enabled: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    const byParent = new Map<string | null, typeof rows>();
    for (const row of rows) {
      const key = row.parentId ?? null;
      byParent.set(key, [...(byParent.get(key) ?? []), row]);
    }
    const toOption = (row: (typeof rows)[number]): GeoLocationOption => ({
      code: row.code,
      name: row.name,
      type: row.type as GeoLocationOption['type'],
      parentCode: row.parentId ?? undefined,
      city: row.cityName ?? undefined,
      center:
        row.centerLat != null && row.centerLng != null
          ? { latitude: row.centerLat, longitude: row.centerLng }
          : undefined,
      children: (byParent.get(row.id) ?? []).map(toOption),
    });
    return (byParent.get(null) ?? []).map(toOption);
  }

  public async findEnabledByCode(code: string) {
    await this.ensureSeeded();
    return this.prisma.location.findFirst({
      where: { code, enabled: true },
      select: { id: true, code: true, name: true, cityName: true },
    });
  }

  private async ensureSeeded(): Promise<void> {
    this.seedPromise ??= this.seed();
    return this.seedPromise;
  }

  private async seed(): Promise<void> {
    for (const location of SEARCH_LOCATIONS) {
      await this.prisma.location.upsert({
        where: { code: location.code },
        create: {
          id: location.code,
          code: location.code,
          name: location.name,
          type: location.type,
          parentId: location.parentCode,
          provinceCode: location.provinceCode,
          cityName: location.cityName,
          displayOrder: location.displayOrder,
          centerLat: location.center?.latitude,
          centerLng: location.center?.longitude,
        },
        update: {
          name: location.name,
          type: location.type,
          parentId: location.parentCode,
          provinceCode: location.provinceCode,
          cityName: location.cityName,
          displayOrder: location.displayOrder,
          centerLat: location.center?.latitude,
          centerLng: location.center?.longitude,
          enabled: true,
        },
      });
    }
    await this.seedH3Cells();
  }

  private async seedH3Cells(): Promise<void> {
    const cabaWeight = 1 / CABA_H3_CELL_LIST.length;
    await this.prisma.locationH3Cell.createMany({
      data: CABA_H3_CELL_LIST.map((h3Cell) => ({
        locationId: 'caba',
        h3Cell,
        weight: cabaWeight,
      })),
      skipDuplicates: true,
    });

    for (const neighborhood of CABA_NEIGHBORHOODS) {
      const geojsonName = NEIGHBORHOOD_GEOJSON_NAME[neighborhood.code];
      const feature = geojsonName ? GEOJSON_FEATURE_BY_NAME.get(geojsonName) : undefined;

      if (!feature) {
        continue;
      }

      const cells = getH3CellsForGeometry(feature.geometry).filter(isH3CellInCaba);
      if (cells.length === 0) continue;

      const weight = 1 / cells.length;

      await this.prisma.$transaction([
        this.prisma.locationH3Cell.deleteMany({
          where: { locationId: neighborhood.code },
        }),
        this.prisma.locationH3Cell.createMany({
          data: cells.map((h3Cell) => ({
            locationId: neighborhood.code,
            h3Cell,
            weight,
          })),
        }),
        this.prisma.locationGeometry.upsert({
          where: { locationId: neighborhood.code },
          create: {
            locationId: neighborhood.code,
            geometry: feature.geometry as object,
            source: GEOJSON_SOURCE,
            version: GEOJSON_VERSION,
          },
          update: {
            geometry: feature.geometry as object,
            source: GEOJSON_SOURCE,
            version: GEOJSON_VERSION,
          },
        }),
      ]);
    }
  }
}
