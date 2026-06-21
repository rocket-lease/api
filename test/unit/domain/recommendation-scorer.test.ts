import {
  RecommendationScorer,
  type VehicleForScoring,
  type ReservationHistoryItem,
  type ScorerInput,
} from '@/domain/services/recommendation-scorer';

const baseVehicle = (overrides: Partial<VehicleForScoring> = {}): VehicleForScoring => ({
  id: 'v1',
  brand: 'Toyota',
  model: 'Corolla',
  transmission: 'Manual',
  province: 'B',
  city: 'CABA',
  passengers: 5,
  isAccessible: false,
  basePriceCents: 50000,
  characteristics: ['GPS', 'BLUETOOTH'],
  enabled: true,
  photos: ['https://i.com/1.jpg'],
  year: 2024,
  mileage: 10000,
  color: 'Rojo',
  trunkLiters: 400,
  isPromoted: false,
  autoAccept: false,
  demandMultiplier: 1,
  ...overrides,
});

const makeHistory = (overrides: Partial<ReservationHistoryItem> = {}): ReservationHistoryItem => ({
  vehicleId: 'h1',
  brand: 'Toyota',
  transmission: 'Manual',
  province: 'B',
  passengers: 5,
  characteristics: ['GPS'],
  ...overrides,
});

const defaultInput = (overrides: Partial<ScorerInput> = {}): ScorerInput => ({
  history: [makeHistory()],
  preferences: null,
  favoriteVehicleIds: [],
  availableVehicles: [baseVehicle()],
  previouslyRentedVehicleIds: [],
  ...overrides,
});

describe('RecommendationScorer', () => {
  let scorer: RecommendationScorer;

  beforeEach(() => {
    scorer = new RecommendationScorer();
  });

  describe('score', () => {
    it('retorna lista vacía si no hay vehículos disponibles', () => {
      const result = scorer.score(defaultInput({ availableVehicles: [] }));
      expect(result).toEqual([]);
    });

    it('asigna score 0 si no hay historial ni preferencias ni favoritos', () => {
      const vehicle = baseVehicle();
      const result = scorer.score(defaultInput({
        history: [],
        preferences: null,
        favoriteVehicleIds: [],
        availableVehicles: [vehicle],
        previouslyRentedVehicleIds: [],
      }));
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(0);
      expect(result[0].reasons).toEqual([]);
    });

    it('puntúa más alto un vehículo de marca alquilada previamente', () => {
      const toyota = baseVehicle({ id: 't1', brand: 'Toyota' });
      const honda = baseVehicle({ id: 'h2', brand: 'Honda' });

      const result = scorer.score(defaultInput({
        history: [makeHistory({ brand: 'Toyota' })],
        availableVehicles: [toyota, honda],
      }));

      const toyotaScore = result.find((s) => s.vehicle.id === 't1')!.score;
      const hondaScore = result.find((s) => s.vehicle.id === 'h2')!.score;
      expect(toyotaScore).toBeGreaterThan(hondaScore);
    });

    it('puntúa más alto si la transmisión coincide con la preferencia', () => {
      const vehicle = baseVehicle({ transmission: 'Automatico' });
      const result = scorer.score(defaultInput({
        history: [],
        preferences: { transmission: 'Automatico' },
        availableVehicles: [vehicle],
        previouslyRentedVehicleIds: [],
      }));
      expect(result[0].score).toBeGreaterThan(0);
      expect(result[0].reasons).toContain('Transmisión coincide con preferencia');
    });

    it('puntúa más alto si el precio está dentro de la preferencia', () => {
      const vehicle = baseVehicle({ basePriceCents: 30000 });
      const result = scorer.score(defaultInput({
        history: [],
        preferences: { maxPriceDailyCents: 50000 },
        availableVehicles: [vehicle],
        previouslyRentedVehicleIds: [],
      }));
      expect(result[0].score).toBeGreaterThan(0);
    });

    it('puntúa más alto si el vehículo es favorito', () => {
      const vehicle = baseVehicle({ id: 'fav1' });
      const result = scorer.score(defaultInput({
        history: [],
        availableVehicles: [vehicle],
        favoriteVehicleIds: ['fav1'],
        previouslyRentedVehicleIds: [],
      }));
      expect(result[0].score).toBeGreaterThan(0);
      expect(result[0].reasons).toContain('Vehículo está en favoritos');
    });

    it('puntúa más alto si el vehículo ya fue alquilado', () => {
      const vehicle = baseVehicle({ id: 'rented1' });
      const result = scorer.score(defaultInput({
        history: [],
        availableVehicles: [vehicle],
        favoriteVehicleIds: [],
        previouslyRentedVehicleIds: ['rented1'],
      }));
      expect(result[0].score).toBeGreaterThan(0);
      expect(result[0].reasons).toContain('Vehículo alquilado anteriormente');
    });

    it('retorna top N vehículos ordenados por score descendente', () => {
      const vehicles = [
        baseVehicle({ id: 'a', brand: 'Toyota' }),
        baseVehicle({ id: 'b', brand: 'Honda' }),
        baseVehicle({ id: 'c', brand: 'Ford' }),
        baseVehicle({ id: 'd', brand: 'Chevrolet' }),
      ];
      const result = scorer.score(defaultInput({
        history: [makeHistory({ brand: 'Toyota' })],
        availableVehicles: vehicles,
      }), 2);
      expect(result).toHaveLength(2);
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    });

    it('coincide por provincia del historial', () => {
      const matchProvince = baseVehicle({ id: 'p1', province: 'B' });
      const otherProvince = baseVehicle({ id: 'p2', province: 'C' });
      const result = scorer.score(defaultInput({
        history: [makeHistory({ province: 'B' })],
        availableVehicles: [matchProvince, otherProvince],
      }));
      const match = result.find((s) => s.vehicle.id === 'p1')!;
      const other = result.find((s) => s.vehicle.id === 'p2')!;
      expect(match.score).toBeGreaterThan(other.score);
    });

    it('coincide por características del historial', () => {
      const withGps = baseVehicle({ id: 'g1', characteristics: ['GPS', 'WIFI'] });
      const withoutGps = baseVehicle({ id: 'g2', characteristics: ['SUNROOF'] });
      const result = scorer.score(defaultInput({
        history: [makeHistory({ characteristics: ['GPS', 'BLUETOOTH'] })],
        availableVehicles: [withGps, withoutGps],
      }));
      const gps = result.find((s) => s.vehicle.id === 'g1')!;
      const noGps = result.find((s) => s.vehicle.id === 'g2')!;
      expect(gps.score).toBeGreaterThan(noGps.score);
    });

    it('puntúa accesible si coincide con preferencia', () => {
      const accessible = baseVehicle({ id: 'a1', isAccessible: true });
      const result = scorer.score(defaultInput({
        history: [],
        preferences: { accessibility: ['wheelchair'] },
        availableVehicles: [accessible],
        previouslyRentedVehicleIds: [],
      }));
      expect(result[0].score).toBeGreaterThan(0);
    });
  });

  describe('findNearAlternatives', () => {
    it('retorna lista vacía si no hay vehículos disponibles', () => {
      const result = scorer.findNearAlternatives([], { brand: 'Toyota' }, 5);
      expect(result).toEqual([]);
    });

    it('asigna menor score a transmisión distinta', () => {
      const manual = baseVehicle({ id: 'm1', transmission: 'Manual' });
      const automatic = baseVehicle({ id: 'a1', transmission: 'Automatico' });
      const result = scorer.findNearAlternatives(
        [manual, automatic],
        { transmission: 'Manual' },
        5,
      );
      const manualEntry = result.find((r) => r.vehicle.id === 'm1')!;
      const autoEntry = result.find((r) => r.vehicle.id === 'a1')!;
      expect(manualEntry.score).toBeGreaterThan(autoEntry.score);
    });

    it('reporta diferencias cuando cambia transmisión', () => {
      const vehicle = baseVehicle({ transmission: 'Automatico' });
      const result = scorer.findNearAlternatives(
        [vehicle],
        { transmission: 'Manual' },
        5,
      );
      expect(result[0].differences.length).toBeGreaterThan(0);
      expect(result[0].differences[0]).toContain('Cambia transmisión');
    });

    it('asigna score según cercanía de precio', () => {
      const cheap = baseVehicle({ id: 'c1', basePriceCents: 30000 });
      const expensive = baseVehicle({ id: 'e1', basePriceCents: 100000 });
      const result = scorer.findNearAlternatives(
        [cheap, expensive],
        { maxPriceCents: 40000 },
        5,
      );
      const cheapEntry = result.find((r) => r.vehicle.id === 'c1')!;
      const expEntry = result.find((r) => r.vehicle.id === 'e1')!;
      expect(cheapEntry.score).toBeGreaterThan(expEntry.score);
    });

    it('reporta diferencia de ubicación cuando cambia ciudad', () => {
      const vehicle = baseVehicle({ city: 'Rosario', province: 'S' });
      const result = scorer.findNearAlternatives(
        [vehicle],
        { city: 'CABA', province: 'B' },
        5,
      );
      expect(result[0].differences.some((d) => d.includes('Ubicación'))).toBe(true);
    });

    it('asigna menor score a marca distinta', () => {
      const toyota = baseVehicle({ id: 't1', brand: 'Toyota' });
      const ford = baseVehicle({ id: 'f1', brand: 'Ford' });
      const result = scorer.findNearAlternatives(
        [toyota, ford],
        { brand: 'Toyota' },
        5,
      );
      const toyotaEntry = result.find((r) => r.vehicle.id === 't1')!;
      const fordEntry = result.find((r) => r.vehicle.id === 'f1')!;
      expect(toyotaEntry.score).toBeGreaterThan(fordEntry.score);
    });

    it('reporta características faltantes', () => {
      const vehicle = baseVehicle({ characteristics: ['GPS'] });
      const result = scorer.findNearAlternatives(
        [vehicle],
        { characteristics: ['GPS', 'WIFI'] },
        5,
      );
      expect(result[0].differences.some((d) => d.includes('No tiene'))).toBe(true);
    });

    it('retorna máximo maxResults vehículos', () => {
      const vehicles = Array.from({ length: 10 }, (_, i) =>
        baseVehicle({ id: `v${i}` }),
      );
      const result = scorer.findNearAlternatives(vehicles, {}, 3);
      expect(result).toHaveLength(3);
    });

    it('ordena por score descendente', () => {
      const vehicles = [
        baseVehicle({ id: 'a', brand: 'Toyota', basePriceCents: 40000 }),
        baseVehicle({ id: 'b', brand: 'Honda', basePriceCents: 80000 }),
        baseVehicle({ id: 'c', brand: 'Ford', basePriceCents: 30000 }),
      ];
      const result = scorer.findNearAlternatives(
        vehicles,
        { brand: 'Toyota', maxPriceCents: 50000 },
        5,
      );
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
      }
    });
  });
});
