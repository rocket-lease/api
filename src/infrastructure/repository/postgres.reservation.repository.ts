import { Injectable } from '@nestjs/common';
import {
  Reservation,
  ReservationStatus,
  PaymentMethod,
} from '@/domain/entities/reservation.entity';
import {
  ReservationRepository,
  ReservationListFilters,
  ReservationListResult,
  ReservationRole,
} from '@/domain/repositories/reservation.repository';
import { PrismaService } from '../database/prisma.service';

type Row = {
  id: string;
  vehicleId: string;
  conductorId: string;
  rentadorId: string;
  status: ReservationStatus;
  startAt: Date;
  endAt: Date;
  holdExpiresAt: Date | null;
  totalCents: number;
  currency: string;
  paymentMethod: PaymentMethod | null;
  contractAcceptedAt: Date | null;
  paidAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PostgresReservationRepository implements ReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(reservation: Reservation): Promise<Reservation> {
    const data = this.toRow(reservation);
    await this.prisma.reservation.create({ data });
    return reservation;
  }

  async update(reservation: Reservation): Promise<Reservation> {
    const data = this.toRow(reservation);
    await this.prisma.reservation.update({
      where: { id: reservation.getId() },
      data,
    });
    return reservation;
  }

  async findById(id: string): Promise<Reservation | null> {
    const row = await this.prisma.reservation.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findOverlapping(
    vehicleId: string,
    startAt: Date,
    endAt: Date,
    statuses: ReservationStatus[],
  ): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        vehicleId,
        status: { in: statuses as any },
        AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
      },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findExpiredHolds(now: Date): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        status: 'pending_payment',
        holdExpiresAt: { lte: now },
      },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findApprovalExpiredBefore(cutoff: Date): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        status: 'pending_approval',
        createdAt: { lte: cutoff },
      },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findOverlappingPendingApproval(
    vehicleId: string,
    startAt: Date,
    endAt: Date,
    excludeId: string,
  ): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        vehicleId,
        status: 'pending_approval',
        id: { not: excludeId },
        AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
      },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async approveWithCascade(
    approved: Reservation,
    cascadedRejections: Reservation[],
  ): Promise<void> {
    const approvedData = this.toRow(approved);
    const ops = [
      this.prisma.reservation.update({
        where: { id: approved.getId() },
        data: approvedData,
      }),
      ...cascadedRejections.map((r) =>
        this.prisma.reservation.update({
          where: { id: r.getId() },
          data: this.toRow(r),
        }),
      ),
    ];
    await this.prisma.$transaction(ops);
  }

  async findActiveByVehicleId(
    vehicleId: string,
    statuses: ReservationStatus[],
  ): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: { vehicleId, status: { in: statuses as any } },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByUser(
    userId: string,
    role: ReservationRole,
    filters: ReservationListFilters,
  ): Promise<ReservationListResult> {
    const where: any =
      role === 'conductor' ? { conductorId: userId } : { rentadorId: userId };
    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status as any };
    }
    if (filters.from || filters.to) {
      where.startAt = {};
      if (filters.from) where.startAt.gte = filters.from;
      if (filters.to) where.startAt.lte = filters.to;
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.toEntity(r)),
      total,
    };
  }

  private toRow(r: Reservation) {
    return {
      id: r.getId(),
      vehicleId: r.getVehicleId(),
      conductorId: r.getConductorId(),
      rentadorId: r.getRentadorId(),
      status: r.getStatus() as any,
      startAt: r.getStartAt(),
      endAt: r.getEndAt(),
      holdExpiresAt: r.getHoldExpiresAt(),
      totalCents: r.getTotalCents(),
      currency: r.getCurrency(),
      paymentMethod: r.getPaymentMethod() as any,
      contractAcceptedAt: r.getContractAcceptedAt(),
      paidAt: r.getPaidAt(),
      rejectionReason: r.getRejectionReason(),
      createdAt: r.getCreatedAt(),
      updatedAt: r.getUpdatedAt(),
    };
  }

  private toEntity(row: Row): Reservation {
    return new Reservation({
      id: row.id,
      vehicleId: row.vehicleId,
      conductorId: row.conductorId,
      rentadorId: row.rentadorId,
      status: row.status,
      startAt: row.startAt,
      endAt: row.endAt,
      holdExpiresAt: row.holdExpiresAt,
      totalCents: row.totalCents,
      currency: (row.currency as 'ARS') ?? 'ARS',
      paymentMethod: row.paymentMethod,
      contractAcceptedAt: row.contractAcceptedAt,
      paidAt: row.paidAt,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
