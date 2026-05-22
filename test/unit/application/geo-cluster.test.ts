import {
  zoomToClusterMode,
  zoomToGridSizeDegrees,
  cellKey,
  haversineKm,
  boundingBoxForRadius,
  centroid,
  fanOutOverlapping,
  RENTADORA_ZOOM_THRESHOLD,
} from '@/application/helpers/geo-cluster';

describe('geo-cluster helpers', () => {
  describe('zoomToClusterMode', () => {
    it('devuelve "zone" a zoom bajo', () => {
      expect(zoomToClusterMode(RENTADORA_ZOOM_THRESHOLD - 1)).toBe('zone');
      expect(zoomToClusterMode(5)).toBe('zone');
    });

    it('devuelve "rentadora" a zoom alto', () => {
      expect(zoomToClusterMode(RENTADORA_ZOOM_THRESHOLD)).toBe('rentadora');
      expect(zoomToClusterMode(18)).toBe('rentadora');
    });
  });

  describe('zoomToGridSizeDegrees', () => {
    it('la celda se achica al aumentar el zoom', () => {
      expect(zoomToGridSizeDegrees(5)).toBeGreaterThan(
        zoomToGridSizeDegrees(15),
      );
    });
  });

  describe('cellKey', () => {
    it('coordenadas cercanas con celda gruesa caen en la misma celda', () => {
      const grid = zoomToGridSizeDegrees(4);
      expect(cellKey(-34.6, -58.4, grid)).toBe(cellKey(-34.9, -58.6, grid));
    });

    it('mismas coordenadas con celda fina caen en celdas distintas', () => {
      const grid = zoomToGridSizeDegrees(20);
      expect(cellKey(-34.6, -58.4, grid)).not.toBe(
        cellKey(-34.9, -58.6, grid),
      );
    });
  });

  describe('haversineKm', () => {
    it('devuelve 0 para el mismo punto', () => {
      expect(haversineKm(-34.6, -58.4, -34.6, -58.4)).toBeCloseTo(0);
    });

    it('aproxima la distancia Buenos Aires - Córdoba (~645 km)', () => {
      const d = haversineKm(-34.6037, -58.3816, -31.4201, -64.1888);
      expect(d).toBeGreaterThan(600);
      expect(d).toBeLessThan(700);
    });
  });

  describe('boundingBoxForRadius', () => {
    it('genera un bbox que contiene el centro', () => {
      const box = boundingBoxForRadius(-34.6, -58.4, 10);
      expect(box.north).toBeGreaterThan(-34.6);
      expect(box.south).toBeLessThan(-34.6);
      expect(box.east).toBeGreaterThan(-58.4);
      expect(box.west).toBeLessThan(-58.4);
    });
  });

  describe('centroid', () => {
    it('promedia los valores', () => {
      expect(centroid([0, 10])).toBe(5);
    });
    it('devuelve 0 para lista vacía', () => {
      expect(centroid([])).toBe(0);
    });
  });

  describe('fanOutOverlapping', () => {
    it('deja intactos los marcadores en ubicaciones distintas', () => {
      const out = fanOutOverlapping(
        [
          { id: 'a', latitude: -34.6, longitude: -58.4 },
          { id: 'b', latitude: -34.9, longitude: -58.9 },
        ],
        0.0001,
        0.002,
      );
      expect(out).toHaveLength(2);
      expect(out.find((m) => m.id === 'a')).toMatchObject({
        latitude: -34.6,
        longitude: -58.4,
      });
    });

    it('separa marcadores que comparten la misma coordenada', () => {
      const out = fanOutOverlapping(
        [
          { id: 'a', latitude: -34.6, longitude: -58.4 },
          { id: 'b', latitude: -34.6, longitude: -58.4 },
          { id: 'c', latitude: -34.6, longitude: -58.4 },
        ],
        0.001,
        0.002,
      );
      expect(out).toHaveLength(3);
      const coords = new Set(out.map((m) => `${m.latitude}_${m.longitude}`));
      expect(coords.size).toBe(3);
    });

    it('separa marcadores cercanos que se pisarían al zoom dado', () => {
      // ~30 m de separación: con una celda de detección amplia se agrupan.
      const out = fanOutOverlapping(
        [
          { id: 'a', latitude: -34.6, longitude: -58.4 },
          { id: 'b', latitude: -34.6003, longitude: -58.4003 },
        ],
        0.002,
        0.002,
      );
      const coords = new Set(out.map((m) => `${m.latitude}_${m.longitude}`));
      expect(coords.size).toBe(2);
      // Ambos quedan a fanRadius del centro → claramente separados.
      expect(out).toHaveLength(2);
    });
  });
});
