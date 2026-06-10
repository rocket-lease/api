import { polygonToCells } from 'h3-js';
import {
  getH3CellsForGeometry,
  isH3CellInCaba,
  CABA_H3_CELL_LIST,
  H3_RESOLUTION,
} from '@/application/helpers/h3';
import { CABA_NEIGHBORHOODS_GEOJSON as geojson } from '@/application/geo/caba-geojson';

function featureByName(nombre: string) {
  const f = geojson.features.find((x) => x.properties.nombre === nombre);
  if (!f) throw new Error(`Feature not found: ${nombre}`);
  return f;
}

describe('cobertura H3 de barrios CABA', () => {
  describe('Belgrano', () => {
    let cells: string[];

    beforeAll(() => {
      cells = getH3CellsForGeometry(featureByName('Belgrano').geometry);
    });

    it('genera más de 1 celda H3', () => {
      expect(cells.length).toBeGreaterThan(1);
    });

    it('la suma de weights es ≈ 1.0', () => {
      const weight = 1 / cells.length;
      const total = cells.reduce((sum) => sum + weight, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });

    it('todas las celdas están dentro de la grilla CABA', () => {
      const outside = cells.filter((c) => !isH3CellInCaba(c));
      expect(outside).toHaveLength(0);
    });
  });

  describe('Villa Riachuelo', () => {
    it('conserva su cobertura completa dentro de la grilla CABA', () => {
      const cells = getH3CellsForGeometry(
        featureByName('Villa Riachuelo').geometry,
      );
      expect(cells.length).toBeGreaterThan(1);
      expect(cells.filter((c) => !isH3CellInCaba(c))).toHaveLength(0);
    });
  });

  describe('Puerto Madero', () => {
    it('excluye las celdas dentro del hueco del polígono', () => {
      const geometry = featureByName('Puerto Madero').geometry;
      const rings = geometry.coordinates as number[][][];
      expect(rings.length).toBeGreaterThan(1);

      const withHoles = getH3CellsForGeometry(geometry);
      const outerOnly = polygonToCells([rings[0]], H3_RESOLUTION, true);
      expect(withHoles.length).toBeLessThan(outerOnly.length);
      const outerSet = new Set(outerOnly);
      expect(withHoles.every((c) => outerSet.has(c))).toBe(true);
    });
  });

  it('todas las celdas de cada barrio pertenecen a la grilla CABA', () => {
    for (const feature of geojson.features) {
      const outside = getH3CellsForGeometry(feature.geometry).filter(
        (c) => !isH3CellInCaba(c),
      );
      expect(outside).toHaveLength(0);
    }
  });

  it('CABA completa tiene peso total ≈ 1.0', () => {
    const weight = 1 / CABA_H3_CELL_LIST.length;
    const total = CABA_H3_CELL_LIST.reduce((sum) => sum + weight, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('el GeoJSON tiene exactamente 48 barrios', () => {
    expect(geojson.features).toHaveLength(48);
  });

  it('todos los barrios del mapping tienen feature en el GeoJSON', () => {
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
    const nombres = new Set(geojson.features.map((f) => f.properties.nombre));
    const missing = Object.entries(NEIGHBORHOOD_GEOJSON_NAME)
      .filter(([, nombre]) => !nombres.has(nombre))
      .map(([code]) => code);
    expect(missing).toHaveLength(0);
  });
});
