import { Injectable } from '@nestjs/common';
import {
  Reservation,
  ReservationStatus,
  PaymentMethod,
} from '@/domain/entities/reservation.entity';
import { ReservationRepository } from '@/domain/repositories/reservation.repository';
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
    return row ? this.toEntity(row as unknown as Row) : null;
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
    return rows.map((r) => this.toEntity(r as unknown as Row));
  }

  async findExpiredHolds(now: Date): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        status: 'pending_payment',
        holdExpiresAt: { lte: now },
      },
    });
    return rows.map((r) => this.toEntity(r as unknown as Row));
  }

  async findByConductorId(conductorId: string): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: { conductorId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toEntity(r as unknown as Row));
  }

  async findActiveByVehicleId(
    vehicleId: string,
    statuses: ReservationStatus[],
  ): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: { vehicleId, status: { in: statuses as any } },
    });
    return rows.map((r) => this.toEntity(r as unknown as Row));
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
