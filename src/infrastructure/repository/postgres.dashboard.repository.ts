import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  DashboardDateRange,
  DashboardRepository,
  DashboardRevenuePointData,
  DashboardSummaryData,
  DashboardVehicleDetailData,
  DashboardVehicleMetricData,
} from '@/domain/repositories/dashboard.repository';

/** Estados que cuentan como ingreso / ocupación efectiva (reserva paga y vigente). */
const REVENUE_STATUSES = ['confirmed', 'in_progress', 'completed'] as const;
/** Estados que ocupan el vehículo en el calendario. */
const OCCUPANCY_STATUSES = ['confirmed', 'in_progress', 'completed'] as const;
/** Estados considerados "activos" para el contador del header. */
const ACTIVE_STATUSES = ['confirmed', 'in_progress'] as const;

/** Umbral de baja ocupación (%). Único lugar donde vive la regla. */
const LOW_OCCUPANCY_THRESHOLD = 30;

/** Ventana fija a futuro para la alerta de baja ocupación (independiente del período). */
const UPCOMING_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ReservationRow = {
  vehicleId: string;
  status: string;
  startAt: Date;
  endAt: Date;
  totalCents: number;
  paidAt: Date | null;
  createdAt: Date;
};

type VehicleRow = {
  id: string;
  brand: string;
  model: string;
  plate: string;
  photos: { url: string }[];
};

/** Acumulador mutable por vehículo mientras recorremos las reservas. */
interface VehicleAccumulator {
  vehicle: VehicleRow;
  occupiedDays: number;
  occupiedRanges: { startMs: number; endMs: number }[]; // tramos recortados al rango
  revenueCents: number; // por FECHA DE INICIO del alquiler (monto completo)
  rentalCount: number; // reservas efectivas (REVENUE_STATUSES) que solapan el rango
  createdTotal: number; // reservas creadas en el rango (denominador de cancelación)
  createdCancelled: number; // canceladas creadas en el rango (numerador)
}

/** Bucket del gráfico con sus límites temporales, para distribuir ingresos. */
interface RevenueBucket {
  date: string;
  startMs: number;
  endMs: number;
  cents: number;
}

@Injectable()
export class PostgresDashboardRepository implements DashboardRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getSummary(
    rentadorId: string,
    range: DashboardDateRange,
  ): Promise<DashboardSummaryData> {
    const vehicles = await this.findVehicles(rentadorId);
    const reservations = await this.findReservations(rentadorId, range);

    const accumulators = new Map<string, VehicleAccumulator>();
    for (const vehicle of vehicles) {
      accumulators.set(vehicle.id, this.emptyAccumulator(vehicle));
    }

    let activeReservations = 0;
    const buckets = this.buildBuckets(range);

    for (const r of reservations) {
      const acc = accumulators.get(r.vehicleId);
      if (!acc) continue; // reserva de un vehículo ya borrado: ignorar
      activeReservations += this.accumulate(acc, r, range, buckets);
    }

    const rangeDays = Math.max(1, this.daysBetween(range.from, range.to));
    const vehicleMetrics = [...accumulators.values()].map((acc) =>
      this.toVehicleMetric(acc, rangeDays),
    );

    const monthlyRevenueCents = vehicleMetrics.reduce(
      (sum, v) => sum + v.revenueCents,
      0,
    );
    const totalOccupiedDays = [...accumulators.values()].reduce(
      (sum, acc) => sum + acc.occupiedDays,
      0,
    );
    const fleetOccupancyRatePercent =
      vehicles.length === 0
        ? 0
        : this.clampPercent(
            (totalOccupiedDays / (vehicles.length * rangeDays)) * 100,
          );

    const totalCreated = [...accumulators.values()].reduce(
      (sum, acc) => sum + acc.createdTotal,
      0,
    );
    const totalCancelled = [...accumulators.values()].reduce(
      (sum, acc) => sum + acc.createdCancelled,
      0,
    );
    const cancellationRatePercent =
      totalCreated === 0
        ? 0
        : this.clampPercent((totalCancelled / totalCreated) * 100);

    // "Más rentados": por días ocupados (≡ % de ocupación, rango fijo) y, a
    // igualdad, por plata transaccionada.
    const topVehicles = [...vehicleMetrics]
      .filter((v) => v.occupancyRatePercent > 0)
      .sort(
        (a, b) =>
          b.occupancyRatePercent - a.occupancyRatePercent ||
          b.revenueCents - a.revenueCents,
      )
      .slice(0, 5);

    const attentionVehicles = await this.computeAttentionVehicles(
      rentadorId,
      vehicles,
      range.now,
    );

    return {
      totalVehicles: vehicles.length,
      activeReservations,
      monthlyRevenueCents,
      fleetOccupancyRatePercent,
      cancellationRatePercent,
      revenueByDay: this.bucketsToPoints(buckets),
      vehicles: vehicleMetrics,
      topVehicles,
      attentionVehicles,
    };
  }

  /**
   * Vehículos con baja ocupación en los próximos `UPCOMING_DAYS` (ventana fija a
   * futuro, NO depende del período seleccionado). Ordenados de menor a mayor
   * ocupación próxima.
   */
  private async computeAttentionVehicles(
    rentadorId: string,
    vehicles: VehicleRow[],
    now: Date,
  ): Promise<
    {
      vehicleId: string;
      brand: string;
      model: string;
      plate: string;
      upcomingOccupancyRatePercent: number;
    }[]
  > {
    if (vehicles.length === 0) return [];

    const from = now;
    const to = new Date(now.getTime() + UPCOMING_DAYS * MS_PER_DAY);
    const reservations = await this.findReservations(rentadorId, {
      from,
      to,
      now,
    });

    const occupiedDays = new Map<string, number>();
    for (const r of reservations) {
      if (!(OCCUPANCY_STATUSES as readonly string[]).includes(r.status)) continue;
      const start = Math.max(r.startAt.getTime(), from.getTime());
      const end = Math.min(r.endAt.getTime(), to.getTime());
      if (end > start) {
        occupiedDays.set(
          r.vehicleId,
          (occupiedDays.get(r.vehicleId) ?? 0) + (end - start) / MS_PER_DAY,
        );
      }
    }

    return vehicles
      .map((v) => {
        const pct = this.clampPercent(
          ((occupiedDays.get(v.id) ?? 0) / UPCOMING_DAYS) * 100,
        );
        return {
          vehicleId: v.id,
          brand: v.brand,
          model: v.model,
          plate: v.plate,
          upcomingOccupancyRatePercent: pct,
        };
      })
      .filter((v) => v.upcomingOccupancyRatePercent < LOW_OCCUPANCY_THRESHOLD)
      .sort(
        (a, b) =>
          a.upcomingOccupancyRatePercent - b.upcomingOccupancyRatePercent,
      );
  }

  async getVehicleDetail(
    rentadorId: string,
    vehicleId: string,
    range: DashboardDateRange,
  ): Promise<DashboardVehicleDetailData | null> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerId: rentadorId },
      select: {
        id: true,
        brand: true,
        model: true,
        plate: true,
        photos: { select: { url: true }, orderBy: { url: 'asc' }, take: 1 },
      },
    });
    if (!vehicle) return null;

    const reservations = await this.findReservations(
      rentadorId,
      range,
      vehicleId,
    );
    const acc = this.emptyAccumulator(vehicle);
    const buckets = this.buildBuckets(range);

    for (const r of reservations) {
      this.accumulate(acc, r, range, buckets);
    }

    const rangeDays = Math.max(1, this.daysBetween(range.from, range.to));
    return {
      vehicle: this.toVehicleMetric(acc, rangeDays),
      revenueByDay: this.bucketsToPoints(buckets),
      reservationCount: acc.rentalCount,
      cancelledCount: acc.createdCancelled,
    };
  }

  // ----- agregación por reserva -----

  /**
   * Acumula una reserva en el vehículo: ocupación, ingresos prorrateados y
   * cancelaciones. Devuelve `1` si la reserva cuenta como activa (para el
   * contador global), `0` si no.
   */
  private accumulate(
    acc: VehicleAccumulator,
    r: ReservationRow,
    range: DashboardDateRange,
    buckets: RevenueBucket[],
  ): number {
    const overlaps = r.startAt < range.to && r.endAt > range.from;
    const createdInRange =
      r.createdAt >= range.from && r.createdAt <= range.to;

    if (createdInRange) {
      acc.createdTotal += 1;
      if (r.status === 'cancelled') acc.createdCancelled += 1;
    }

    if (overlaps && (OCCUPANCY_STATUSES as readonly string[]).includes(r.status)) {
      const start = Math.max(r.startAt.getTime(), range.from.getTime());
      const end = Math.min(r.endAt.getTime(), range.to.getTime());
      if (end > start) {
        acc.occupiedDays += (end - start) / MS_PER_DAY;
        acc.occupiedRanges.push({ startMs: start, endMs: end });
      }
      acc.rentalCount += 1;
    }

    if ((REVENUE_STATUSES as readonly string[]).includes(r.status)) {
      // Ingreso por FECHA DE INICIO: el monto completo cuenta en el período
      // donde arranca el alquiler. Un alquiler futuro no suma a este período.
      this.accrueIncome(acc, r, range, buckets);
    }

    // "Activa" = en curso hoy (no del período): el alquiler abarca el momento now.
    const isActive =
      (ACTIVE_STATUSES as readonly string[]).includes(r.status) &&
      r.startAt <= range.now &&
      r.endAt >= range.now;
    return isActive ? 1 : 0;
  }

  /**
   * Suma el total de la reserva al período si su `startAt` cae dentro del rango,
   * y lo imputa al bucket que contiene esa fecha de inicio.
   */
  private accrueIncome(
    acc: VehicleAccumulator,
    r: ReservationRow,
    range: DashboardDateRange,
    buckets: RevenueBucket[],
  ): void {
    const startMs = r.startAt.getTime();
    if (startMs < range.from.getTime() || startMs > range.to.getTime()) return;

    acc.revenueCents += r.totalCents;

    const bucket =
      buckets.find((b) => startMs >= b.startMs && startMs < b.endMs) ??
      buckets[buckets.length - 1];
    if (bucket) bucket.cents += r.totalCents;
  }

  // ----- queries -----

  private async findVehicles(rentadorId: string): Promise<VehicleRow[]> {
    return this.prisma.vehicle.findMany({
      where: { ownerId: rentadorId },
      select: {
        id: true,
        brand: true,
        model: true,
        plate: true,
        photos: { select: { url: true }, orderBy: { url: 'asc' }, take: 1 },
      },
    });
  }

  private async findReservations(
    rentadorId: string,
    range: DashboardDateRange,
    vehicleId?: string,
  ): Promise<ReservationRow[]> {
    return this.prisma.reservation.findMany({
      where: {
        rentadorId,
        ...(vehicleId ? { vehicleId } : {}),
        OR: [
          // solapan el rango (ocupación / ingresos)
          { startAt: { lt: range.to }, endAt: { gt: range.from } },
          // creadas dentro del rango (cancelación)
          { createdAt: { gte: range.from, lte: range.to } },
        ],
      },
      select: {
        vehicleId: true,
        status: true,
        startAt: true,
        endAt: true,
        totalCents: true,
        paidAt: true,
        createdAt: true,
      },
    });
  }

  // ----- helpers -----

  private emptyAccumulator(vehicle: VehicleRow): VehicleAccumulator {
    return {
      vehicle,
      occupiedDays: 0,
      occupiedRanges: [],
      revenueCents: 0,
      rentalCount: 0,
      createdTotal: 0,
      createdCancelled: 0,
    };
  }

  private toVehicleMetric(
    acc: VehicleAccumulator,
    rangeDays: number,
  ): DashboardVehicleMetricData {
    const occupancyRatePercent = this.clampPercent(
      (acc.occupiedDays / rangeDays) * 100,
    );
    const cancellationRatePercent =
      acc.createdTotal === 0
        ? 0
        : this.clampPercent((acc.createdCancelled / acc.createdTotal) * 100);

    return {
      vehicleId: acc.vehicle.id,
      brand: acc.vehicle.brand,
      model: acc.vehicle.model,
      plate: acc.vehicle.plate,
      photoUrl: acc.vehicle.photos[0]?.url ?? null,
      occupancyRatePercent,
      occupiedRanges: acc.occupiedRanges.map((r) => ({
        startAt: new Date(r.startMs).toISOString(),
        endAt: new Date(r.endMs).toISOString(),
      })),
      revenueCents: Math.round(acc.revenueCents),
      reservationCount: acc.rentalCount,
      cancellationRatePercent,
      lowOccupancy: occupancyRatePercent < LOW_OCCUPANCY_THRESHOLD,
    };
  }

  private daysBetween(from: Date, to: Date): number {
    return (to.getTime() - from.getTime()) / MS_PER_DAY;
  }

  private clampPercent(value: number): number {
    return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
  }

  /**
   * Crea los buckets vacíos del gráfico. Granularidad: diaria si el rango
   * dura <= 31 días (semana/mes), semanal si es más largo (trimestre/custom).
   */
  private buildBuckets(range: DashboardDateRange): RevenueBucket[] {
    const fromMs = range.from.getTime();
    const toMs = range.to.getTime();
    const totalDays = Math.ceil((toMs - fromMs) / MS_PER_DAY);
    const stepDays = totalDays <= 31 ? 1 : 7;
    const buckets: RevenueBucket[] = [];
    for (let offset = 0; offset < totalDays; offset += stepDays) {
      const startMs = fromMs + offset * MS_PER_DAY;
      const endMs = Math.min(startMs + stepDays * MS_PER_DAY, toMs);
      buckets.push({
        date: this.toDateKey(new Date(startMs)),
        startMs,
        endMs,
        cents: 0,
      });
    }
    if (buckets.length === 0) {
      buckets.push({
        date: this.toDateKey(range.from),
        startMs: fromMs,
        endMs: toMs,
        cents: 0,
      });
    }
    return buckets;
  }

  private bucketsToPoints(buckets: RevenueBucket[]): DashboardRevenuePointData[] {
    return buckets.map((b) => ({
      date: b.date,
      totalCents: Math.round(b.cents),
    }));
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
