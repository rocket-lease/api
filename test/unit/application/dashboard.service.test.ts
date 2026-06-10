import { DashboardService } from '@/application/dashboard.service';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import type { DashboardRepository } from '@/domain/repositories/dashboard.repository';
import type { UserRepository } from '@/domain/repositories/user.repository';
import type { Clock } from '@/domain/providers/clock.provider';
import { randomUUID } from 'crypto';

const rentadorId = randomUUID();
const vehicleId = randomUUID();

const NOW = new Date('2026-06-04T12:00:00.000Z');

function makeVehicleMetric() {
  return {
    vehicleId,
    brand: 'Toyota',
    model: 'Corolla',
    plate: 'ABC123',
    photoUrl: null,
    occupancyRatePercent: 20,
    occupiedRanges: [],
    revenueCents: 500000,
    reservationCount: 2,
    cancellationRatePercent: 10,
    lowOccupancy: true,
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let dashboardRepo: jest.Mocked<DashboardRepository>;
  let userRepo: jest.Mocked<UserRepository>;
  let clock: Clock;

  beforeEach(() => {
    dashboardRepo = {
      getSummary: jest.fn(),
      getVehicleDetail: jest.fn(),
    };
    userRepo = {
      getProfileById: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;
    clock = { now: () => NOW };
    service = new DashboardService(dashboardRepo, userRepo, clock);
  });

  describe('getSummary', () => {
    it('traduce period=week a la semana calendario (lun-dom) que contiene hoy', async () => {
      dashboardRepo.getSummary.mockResolvedValue({
        totalVehicles: 1,
        activeReservations: 0,
        monthlyRevenueCents: 0,
        fleetOccupancyRatePercent: 0,
        cancellationRatePercent: 0,
        revenueByDay: [],
        vehicles: [],
        topVehicles: [],
        attentionVehicles: [],
      });
      userRepo.getProfileById.mockResolvedValue(null);

      await service.getSummary(rentadorId, 'week');

      const [, range] = dashboardRepo.getSummary.mock.calls[0];
      // NOW = jueves 2026-06-04 → semana 2026-06-01 (lun) .. 2026-06-07 (dom).
      expect(range.from.toISOString().slice(0, 10)).toBe('2026-06-01');
      expect(range.from.getUTCDay()).toBe(1); // lunes
      expect(range.now).toEqual(NOW);
      expect(range.from <= NOW && NOW <= range.to).toBe(true);
      const days =
        (range.to.getTime() - range.from.getTime()) / 86_400_000;
      expect(Math.round(days)).toBe(7);
    });

    it('traduce quarter al trimestre calendario en curso', async () => {
      dashboardRepo.getSummary.mockResolvedValue({
        totalVehicles: 0,
        activeReservations: 0,
        monthlyRevenueCents: 0,
        fleetOccupancyRatePercent: 0,
        cancellationRatePercent: 0,
        revenueByDay: [],
        vehicles: [],
        topVehicles: [],
        attentionVehicles: [],
      });
      userRepo.getProfileById.mockResolvedValue(null);

      await service.getSummary(rentadorId, 'quarter');

      const [, range] = dashboardRepo.getSummary.mock.calls[0];
      // NOW junio → Q2: abril (mes 3) a junio (mes 5).
      expect(range.from.getUTCMonth()).toBe(3); // abril
      expect(range.from.getUTCDate()).toBe(1);
      expect(range.to.getUTCMonth()).toBe(5); // junio
      expect(range.from <= NOW && NOW <= range.to).toBe(true);
    });

    it('traduce month al mes calendario en curso', async () => {
      dashboardRepo.getSummary.mockResolvedValue({
        totalVehicles: 0,
        activeReservations: 0,
        monthlyRevenueCents: 0,
        fleetOccupancyRatePercent: 0,
        cancellationRatePercent: 0,
        revenueByDay: [],
        vehicles: [],
        topVehicles: [],
        attentionVehicles: [],
      });
      userRepo.getProfileById.mockResolvedValue(null);

      await service.getSummary(rentadorId, 'month');

      const [, range] = dashboardRepo.getSummary.mock.calls[0];
      expect(range.from.toISOString().slice(0, 10)).toBe('2026-06-01');
      expect(range.to.getUTCMonth()).toBe(5); // junio
      expect(range.to.getUTCDate()).toBe(30);
    });

    it('incluye el reputationScore del perfil y arma un response válido', async () => {
      dashboardRepo.getSummary.mockResolvedValue({
        totalVehicles: 1,
        activeReservations: 1,
        monthlyRevenueCents: 500000,
        fleetOccupancyRatePercent: 20,
        cancellationRatePercent: 10,
        revenueByDay: [{ date: '2026-06-01', totalCents: 500000 }],
        vehicles: [makeVehicleMetric()],
        topVehicles: [makeVehicleMetric()],
        attentionVehicles: [],
      });
      userRepo.getProfileById.mockResolvedValue({
        reputationScore: 4.7,
      } as never);

      const result = await service.getSummary(rentadorId, 'month');

      expect(result.reputationScore).toBe(4.7);
      expect(result.period).toBe('month');
      expect(result.vehicles).toHaveLength(1);
      expect(result.topVehicles[0].vehicleId).toBe(vehicleId);
    });

    it('usa reputationScore 0 si no hay perfil', async () => {
      dashboardRepo.getSummary.mockResolvedValue({
        totalVehicles: 0,
        activeReservations: 0,
        monthlyRevenueCents: 0,
        fleetOccupancyRatePercent: 0,
        cancellationRatePercent: 0,
        revenueByDay: [],
        vehicles: [],
        topVehicles: [],
        attentionVehicles: [],
      });
      userRepo.getProfileById.mockResolvedValue(null);

      const result = await service.getSummary(rentadorId, 'month');

      expect(result.reputationScore).toBe(0);
    });
  });

  describe('getVehicleDetail', () => {
    it('retorna el detalle cuando el vehículo es del rentador', async () => {
      dashboardRepo.getVehicleDetail.mockResolvedValue({
        vehicle: makeVehicleMetric(),
        revenueByDay: [{ date: '2026-06-01', totalCents: 500000 }],
        reservationCount: 2,
        cancelledCount: 1,
      });

      const result = await service.getVehicleDetail(
        rentadorId,
        vehicleId,
        'month',
      );

      expect(result.vehicle.vehicleId).toBe(vehicleId);
      expect(result.cancelledCount).toBe(1);
    });

    it('lanza EntityNotFoundException si el vehículo no pertenece al rentador', async () => {
      dashboardRepo.getVehicleDetail.mockResolvedValue(null);

      await expect(
        service.getVehicleDetail(rentadorId, vehicleId, 'month'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
