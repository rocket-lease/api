import { Inject, Injectable } from '@nestjs/common';
import { DASHBOARD_REPOSITORY } from '@/domain/repositories/dashboard.repository';
import type {
  DashboardDateRange,
  DashboardRepository,
  DashboardVehicleMetricData,
} from '@/domain/repositories/dashboard.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import {
  DashboardPeriod,
  DashboardSummaryResponse,
  DashboardSummaryResponseSchema,
  DashboardVehicleDetailResponse,
  DashboardVehicleDetailResponseSchema,
  DashboardVehicleMetric,
} from '@rocket-lease/contracts';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly dashboardRepository: DashboardRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  public async getSummary(
    rentadorId: string,
    period: DashboardPeriod,
    custom?: { from?: string; to?: string },
  ): Promise<DashboardSummaryResponse> {
    const range = this.resolveRange(period, custom);
    const [data, profile] = await Promise.all([
      this.dashboardRepository.getSummary(rentadorId, range),
      this.userRepository.getProfileById(rentadorId),
    ]);

    return DashboardSummaryResponseSchema.parse({
      period,
      range: this.toRangeDto(range),
      totalVehicles: data.totalVehicles,
      activeReservations: data.activeReservations,
      monthlyRevenueCents: data.monthlyRevenueCents,
      fleetOccupancyRatePercent: data.fleetOccupancyRatePercent,
      cancellationRatePercent: data.cancellationRatePercent,
      reputationScore: profile?.reputationScore ?? 0,
      revenueByDay: data.revenueByDay,
      vehicles: data.vehicles.map((v) => this.toVehicleMetricDto(v)),
      topVehicles: data.topVehicles.map((v) => this.toVehicleMetricDto(v)),
      attentionVehicles: data.attentionVehicles,
    });
  }

  public async getVehicleDetail(
    rentadorId: string,
    vehicleId: string,
    period: DashboardPeriod,
    custom?: { from?: string; to?: string },
  ): Promise<DashboardVehicleDetailResponse> {
    const range = this.resolveRange(period, custom);
    const data = await this.dashboardRepository.getVehicleDetail(
      rentadorId,
      vehicleId,
      range,
    );
    if (!data) throw new EntityNotFoundException('vehicle', vehicleId);

    return DashboardVehicleDetailResponseSchema.parse({
      period,
      range: this.toRangeDto(range),
      vehicle: this.toVehicleMetricDto(data.vehicle),
      revenueByDay: data.revenueByDay,
      reservationCount: data.reservationCount,
      cancelledCount: data.cancelledCount,
    });
  }

  /**
   * Traduce el período a un rango calendario que contiene "hoy" (UTC):
   * week = semana en curso (lunes a domingo), month = mes en curso,
   * quarter = trimestre en curso. Incluye días futuros del período (p. ej.
   * reservas próximas del mes). custom = rango explícito `from..to`.
   */
  private resolveRange(
    period: DashboardPeriod,
    custom?: { from?: string; to?: string },
  ): DashboardDateRange {
    const now = this.clock.now();

    if (period === 'custom' && custom?.from && custom?.to) {
      return { from: new Date(custom.from), to: new Date(custom.to), now };
    }

    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();

    if (period === 'week') {
      // Lunes 00:00 → domingo 23:59:59.999 (UTC).
      const dow = now.getUTCDay(); // 0=domingo … 6=sábado
      const daysSinceMonday = (dow + 6) % 7;
      const from = new Date(Date.UTC(y, m, d - daysSinceMonday));
      const to = new Date(from.getTime() + 7 * MS_PER_DAY - 1);
      return { from, to, now };
    }

    if (period === 'quarter') {
      const qStartMonth = Math.floor(m / 3) * 3;
      const from = new Date(Date.UTC(y, qStartMonth, 1));
      const to = new Date(Date.UTC(y, qStartMonth + 3, 1) - 1);
      return { from, to, now };
    }

    // month
    const from = new Date(Date.UTC(y, m, 1));
    const to = new Date(Date.UTC(y, m + 1, 1) - 1);
    return { from, to, now };
  }

  private toRangeDto(range: DashboardDateRange): {
    startAt: string;
    endAt: string;
  } {
    return {
      startAt: range.from.toISOString(),
      endAt: range.to.toISOString(),
    };
  }

  private toVehicleMetricDto(
    data: DashboardVehicleMetricData,
  ): DashboardVehicleMetric {
    return {
      vehicleId: data.vehicleId,
      brand: data.brand,
      model: data.model,
      plate: data.plate,
      photoUrl: data.photoUrl,
      occupancyRatePercent: data.occupancyRatePercent,
      occupiedRanges: data.occupiedRanges,
      revenueCents: data.revenueCents,
      reservationCount: data.reservationCount,
      cancellationRatePercent: data.cancellationRatePercent,
      lowOccupancy: data.lowOccupancy,
    };
  }
}
