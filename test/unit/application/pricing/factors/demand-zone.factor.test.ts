import { DemandZoneFactor } from '@/application/pricing/factors/demand-zone.factor';
import type { PricingStatsRepository } from '@/domain/repositories/pricing-stats.repository';
import type { SearchLogRepository } from '@/domain/repositories/search-log.repository';
import type { PriceQuoteRepository } from '@/domain/repositories/price-quote.repository';
import type { Clock } from '@/domain/providers/clock.provider';

const FIXED_NOW = new Date('2026-06-07T12:00:00Z');
const CABA_LAT = -34.6037;
const CABA_LON = -58.3816;
const DEMAND_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('DemandZoneFactor', () => {
  let factor: DemandZoneFactor;
  let statsMock: jest.Mocked<PricingStatsRepository>;
  let searchLogMock: jest.Mocked<SearchLogRepository>;
  let priceQuoteMock: jest.Mocked<PriceQuoteRepository>;
  let clockMock: jest.Mocked<Clock>;

  const noSignals = { search: 0, vehicleView: 0, quote: 0, reservation: 0 };

  beforeEach(() => {
    statsMock = {
      countConfirmedInHexSince: jest.fn().mockResolvedValue(0),
      countAvailableInHex: jest.fn().mockResolvedValue(1),
      countConfirmedReservationsSince: jest.fn(),
      computeUtilizationForWindow: jest.fn(),
      aggregateAdminZones: jest.fn(),
    };
    searchLogMock = {
      countSignalsInHexSince: jest.fn().mockResolvedValue(noSignals),
      save: jest.fn(),
      findLastBySessionAndSignal: jest.fn(),
      countByHexSince: jest.fn(),
      aggregateByH3Since: jest.fn(),
      aggregateByH3AndSignalSince: jest.fn(),
      deleteOlderThan: jest.fn(),
    };
    priceQuoteMock = {
      countByHexSince: jest.fn().mockResolvedValue(0),
      save: jest.fn(),
      findById: jest.fn(),
      aggregateMultiplierByH3Since: jest.fn(),
      deleteExpiredBefore: jest.fn(),
    };
    clockMock = { now: jest.fn().mockReturnValue(FIXED_NOW) };
    factor = new DemandZoneFactor(statsMock, searchLogMock, priceQuoteMock, clockMock);
  });

  // ─── coordenadas inválidas ─────────────────────────────────────────────────

  describe('coordenadas inválidas', () => {
    it('retorna 1.0 y no consulta repos cuando latitude es null', async () => {
      const result = await factor.compute(null, CABA_LON);

      expect(result).toBe(1.0);
      expect(searchLogMock.countSignalsInHexSince).not.toHaveBeenCalled();
      expect(priceQuoteMock.countByHexSince).not.toHaveBeenCalled();
      expect(statsMock.countConfirmedInHexSince).not.toHaveBeenCalled();
      expect(statsMock.countAvailableInHex).not.toHaveBeenCalled();
    });

    it('retorna 1.0 y no consulta repos cuando longitude es null', async () => {
      const result = await factor.compute(CABA_LAT, null);

      expect(result).toBe(1.0);
      expect(searchLogMock.countSignalsInHexSince).not.toHaveBeenCalled();
      expect(priceQuoteMock.countByHexSince).not.toHaveBeenCalled();
      expect(statsMock.countConfirmedInHexSince).not.toHaveBeenCalled();
      expect(statsMock.countAvailableInHex).not.toHaveBeenCalled();
    });
  });

  // ─── supply === 0 ──────────────────────────────────────────────────────────

  describe('supply === 0', () => {
    it('retorna 1.0 aunque haya demanda', async () => {
      statsMock.countAvailableInHex.mockResolvedValue(0);
      searchLogMock.countSignalsInHexSince.mockResolvedValue({
        search: 10,
        vehicleView: 5,
        quote: 2,
        reservation: 1,
      });

      const result = await factor.compute(CABA_LAT, CABA_LON);

      expect(result).toBe(1.0);
    });
  });

  // ─── cálculo de ratio ──────────────────────────────────────────────────────

  describe('rampa de surge por ratio', () => {
    it('retorna 1.0 sin señales (demand=0, ratio=0 ≤ startRatio)', async () => {
      const result = await factor.compute(CABA_LAT, CABA_LON);

      expect(result).toBe(1.0);
    });

    it('retorna 1.0 cuando ratio ≤ 1 (search=5, supply=10 → ratio=0.5)', async () => {
      searchLogMock.countSignalsInHexSince.mockResolvedValue({
        search: 5,
        vehicleView: 0,
        quote: 0,
        reservation: 0,
      });
      statsMock.countAvailableInHex.mockResolvedValue(10);

      const result = await factor.compute(CABA_LAT, CABA_LON);

      expect(result).toBe(1.0);
    });

    it('topea en 1.5 cuando ratio ≥ fullRatio (reservation=1, supply=1 → ratio=50)', async () => {
      statsMock.countConfirmedInHexSince.mockResolvedValue(1);
      statsMock.countAvailableInHex.mockResolvedValue(1);

      const result = await factor.compute(CABA_LAT, CABA_LON);

      expect(result).toBe(1.5);
    });

    it('sube gradual a mitad de rampa (vehicleView=3, supply=2 → ratio=7.5)', async () => {
      searchLogMock.countSignalsInHexSince.mockResolvedValue({
        search: 0,
        vehicleView: 3,
        quote: 0,
        reservation: 0,
      });
      statsMock.countAvailableInHex.mockResolvedValue(2);

      const result = await factor.compute(CABA_LAT, CABA_LON);

      expect(result).toBeCloseTo(1.171, 3);
    });

    it('apenas sube con ratio bajo (search=10, supply=5 → ratio=2)', async () => {
      searchLogMock.countSignalsInHexSince.mockResolvedValue({
        search: 10,
        vehicleView: 0,
        quote: 0,
        reservation: 0,
      });
      statsMock.countAvailableInHex.mockResolvedValue(5);

      const result = await factor.compute(CABA_LAT, CABA_LON);

      expect(result).toBeCloseTo(1.026, 3);
    });
  });

  // ─── ponderación por señal ─────────────────────────────────────────────────

  describe('ponderación por señal', () => {
    it('quote pesa 20: supply=1, quote=1 → ratio=20 → topa en 1.5', async () => {
      priceQuoteMock.countByHexSince.mockResolvedValue(1);

      const result = await factor.compute(CABA_LAT, CABA_LON);

      expect(result).toBe(1.5);
    });

    it('vehicleView pesa 5: supply=1, vehicleView=1 → ratio=5', async () => {
      searchLogMock.countSignalsInHexSince.mockResolvedValue({
        search: 0,
        vehicleView: 1,
        quote: 0,
        reservation: 0,
      });

      const result = await factor.compute(CABA_LAT, CABA_LON);

      expect(result).toBeCloseTo(1.105, 3);
    });
  });

  // ─── ventana temporal ──────────────────────────────────────────────────────

  describe('ventana temporal', () => {
    it('pasa since = FIXED_NOW - 7 días a countSignalsInHexSince', async () => {
      const expectedSince = new Date(FIXED_NOW.getTime() - DEMAND_WINDOW_DAYS * DAY_MS);

      await factor.compute(CABA_LAT, CABA_LON);

      expect(searchLogMock.countSignalsInHexSince).toHaveBeenCalledWith(
        expect.any(String),
        expectedSince,
      );
    });
  });
});
