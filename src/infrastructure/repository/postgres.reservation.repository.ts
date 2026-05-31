import { Injectable, Inject } from '@nestjs/common';
import {
  Reservation,
  ReservationStatus,
  RESERVATION_STATUS,
} from '@/domain/entities/reservation.entity';
import type {
  CancellationPolicy,
  MaxKilometrage,
  RentalTimeConstraints,
} from '@rocket-lease/contracts';
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
  paymentMethod: any;
  walletProvider: string | null;
  contractAcceptedAt: Date | null;
  paidAt: Date | null;
  voucherToken: string | null;
  returnQrToken: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  rejectionReason: string | null;
  transferExpiresAt: Date | null;
  transferCode: string | null;
  transferAlias: string | null;
  transferPaymentMode: string | null;
  depositPaidCents: number | null;
  depositPaidAt: Date | null;
  balanceDueAt: Date | null;
  balanceReminderSentAt: Date | null;
  depositPercentageSnapshot: number | null;
  basePriceCentsSnapshot: number;
  cancellationPolicySnapshot: string;
  maxKilometrageTypeSnapshot: string;
  maxKilometrageValueSnapshot: number | null;
  minRentalDaysSnapshot: number;
  maxRentalDaysSnapshot: number | null;
  withHomeDelivery: boolean;
  homeDeliveryFeeCentsSnapshot: number | null;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  withHomeReturn: boolean;
  homeReturnFeeCentsSnapshot: number | null;
  returnAddress: string | null;
  returnLatitude: number | null;
  returnLongitude: number | null;
  parentReservationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PostgresReservationRepository implements ReservationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  async findByVoucherToken(token: string): Promise<Reservation | null> {
    const row = await this.prisma.reservation.findFirst({ where: { voucherToken: token } });
    return row ? this.toEntity(row) : null;
  }

  async findByReturnQrToken(token: string): Promise<Reservation | null> {
    const row = await this.prisma.reservation.findUnique({ where: { returnQrToken: token } });
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

  async findExpiredTransfers(now: Date): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        status: 'pending_approval',
        transferExpiresAt: { lte: now },
      },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findOverdueBalances(now: Date): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        status: 'pending_balance',
        balanceDueAt: { lte: now },
      },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findBalanceReminderCandidates(now: Date): Promise<Reservation[]> {
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const rows = await this.prisma.reservation.findMany({
      where: {
        status: 'pending_balance',
        balanceReminderSentAt: null,
        balanceDueAt: { gte: from, lte: to },
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

  async hasActiveReservations(userId: string): Promise<boolean> {
    const activeStatuses = [
      RESERVATION_STATUS.confirmed,
      RESERVATION_STATUS.in_progress,
      RESERVATION_STATUS.pending_payment,
    ];
    const count = await this.prisma.reservation.count({
      where: {
        OR: [{ conductorId: userId }, { rentadorId: userId }],
        status: { in: activeStatuses },
      },
    });
    return count > 0;
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

  /**
   * Resuelve la raíz del chain (la reserva sin `parentReservationId`) usando
   * un CTE recursivo "hacia arriba", luego desciende por todos los hijos
   * "hacia abajo" para devolver el árbol completo. Aunque la US asume chain
   * lineal, el desc es robusto a la presencia de ramas (defensa en profundidad
   * si en el futuro se permite forkear). Orden estable por `startAt` asc.
   */
  async findChain(reservationId: string): Promise<Reservation[]> {
    const rows = await this.prisma.$queryRaw<Row[]>`
      WITH RECURSIVE upward AS (
        SELECT * FROM reservations WHERE id = ${reservationId}
        UNION ALL
        SELECT r.* FROM reservations r
        INNER JOIN upward u ON r.id = u.parent_reservation_id
      ),
      root AS (
        SELECT id FROM upward WHERE parent_reservation_id IS NULL LIMIT 1
      ),
      downward AS (
        SELECT * FROM reservations WHERE id = (SELECT id FROM root)
        UNION ALL
        SELECT r.* FROM reservations r
        INNER JOIN downward d ON r.parent_reservation_id = d.id
      )
      SELECT
        id,
        vehicle_id            AS "vehicleId",
        conductor_id          AS "conductorId",
        rentador_id           AS "rentadorId",
        status,
        start_at              AS "startAt",
        end_at                AS "endAt",
        hold_expires_at       AS "holdExpiresAt",
        total_cents           AS "totalCents",
        currency,
        payment_method        AS "paymentMethod",
        wallet_provider       AS "walletProvider",
        contract_accepted_at  AS "contractAcceptedAt",
        paid_at               AS "paidAt",
        voucher_token         AS "voucherToken",
        return_qr_token       AS "returnQrToken",
        started_at            AS "startedAt",
        completed_at          AS "completedAt",
        rejection_reason      AS "rejectionReason",
        transfer_expires_at   AS "transferExpiresAt",
        transfer_code         AS "transferCode",
        transfer_alias        AS "transferAlias",
        deposit_percentage_snapshot   AS "depositPercentageSnapshot",
        base_price_cents_snapshot     AS "basePriceCentsSnapshot",
        cancellation_policy_snapshot  AS "cancellationPolicySnapshot",
        max_kilometrage_type_snapshot AS "maxKilometrageTypeSnapshot",
        max_kilometrage_value_snapshot AS "maxKilometrageValueSnapshot",
        min_rental_days_snapshot      AS "minRentalDaysSnapshot",
        max_rental_days_snapshot      AS "maxRentalDaysSnapshot",
        parent_reservation_id AS "parentReservationId",
        created_at            AS "createdAt",
        updated_at            AS "updatedAt"
      FROM downward
      ORDER BY start_at ASC
    `;
    return rows.map((r) => this.toEntity(r));
  }

  /**
   * Encadena por `parent_reservation_id` hasta el último eslabón "vivo" del
   * chain. Vivo = cualquier estado distinto de `cancelled`, `rejected` y
   * `expired`. Si el último confirmado tiene una extensión cancelada
   * posterior, esa cancelada queda fuera y la punta sigue siendo el
   * confirmado anterior.
   */
  async findChainTipFor(reservationId: string): Promise<Reservation | null> {
    const chain = await this.findChain(reservationId);
    if (chain.length === 0) return null;
    const alive = chain.filter((r) => {
      const status = r.getStatus();
      return (
        status !== RESERVATION_STATUS.cancelled &&
        status !== RESERVATION_STATUS.rejected &&
        status !== RESERVATION_STATUS.expired
      );
    });
    if (alive.length === 0) return null;
    return alive.reduce((tip, candidate) =>
      candidate.getEndAt().getTime() > tip.getEndAt().getTime() ? candidate : tip,
    );
  }

  async updateMany(reservations: Reservation[]): Promise<void> {
    if (reservations.length === 0) return;
    const ops = reservations.map((r) =>
      this.prisma.reservation.update({
        where: { id: r.getId() },
        data: this.toRow(r),
      }),
    );
    await this.prisma.$transaction(ops);
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
      walletProvider: r.getWalletProvider() ?? null,
      contractAcceptedAt: r.getContractAcceptedAt(),
      paidAt: r.getPaidAt(),
      voucherToken: r.getVoucherToken(),
      returnQrToken: r.getReturnQrToken(),
      startedAt: r.getStartedAt(),
      completedAt: r.getCompletedAt(),
      rejectionReason: r.getRejectionReason(),
      transferExpiresAt: r.getTransferExpiresAt(),
      transferCode: r.getTransferCode() ?? null,
      transferAlias: r.getTransferAlias() ?? null,
      transferPaymentMode: r.getTransferPaymentMode() ?? null,
      depositPaidCents: r.getDepositPaidCents(),
      depositPaidAt: r.getDepositPaidAt(),
      balanceDueAt: r.getBalanceDueAt(),
      balanceReminderSentAt: r.getBalanceReminderSentAt(),
      depositPercentageSnapshot: r.getDepositPercentageSnapshot(),
      basePriceCentsSnapshot: r.getBasePriceCentsSnapshot(),
      cancellationPolicySnapshot: r.getCancellationPolicySnapshot(),
      maxKilometrageTypeSnapshot: r.getMaxKilometrageSnapshot().type,
      maxKilometrageValueSnapshot:
        r.getMaxKilometrageSnapshot().type === 'LIMITED'
          ? (r.getMaxKilometrageSnapshot() as { type: 'LIMITED'; value: number }).value
          : null,
      minRentalDaysSnapshot:
        r.getRentalTimeConstraintsSnapshot().minDays ?? 1,
      maxRentalDaysSnapshot:
        r.getRentalTimeConstraintsSnapshot().maxDays ?? null,
      withHomeDelivery: r.getWithHomeDelivery(),
      homeDeliveryFeeCentsSnapshot: r.getHomeDeliveryFeeCentsSnapshot(),
      deliveryAddress: r.getDeliveryAddress()?.address ?? null,
      deliveryLatitude: r.getDeliveryAddress()?.latitude ?? null,
      deliveryLongitude: r.getDeliveryAddress()?.longitude ?? null,
      withHomeReturn: r.getWithHomeReturn(),
      homeReturnFeeCentsSnapshot: r.getHomeReturnFeeCentsSnapshot(),
      returnAddress: r.getReturnAddress()?.address ?? null,
      returnLatitude: r.getReturnAddress()?.latitude ?? null,
      returnLongitude: r.getReturnAddress()?.longitude ?? null,
      parentReservationId: r.getParentReservationId(),
      createdAt: r.getCreatedAt(),
      updatedAt: r.getUpdatedAt(),
    };
  }

  private toEntity(row: Row): Reservation {
    const maxKilometrage =
      row.maxKilometrageTypeSnapshot === 'LIMITED'
        ? ({
            type: 'LIMITED',
            value: row.maxKilometrageValueSnapshot ?? 0,
          } as MaxKilometrage)
        : ({ type: 'UNLIMITED' } as MaxKilometrage);
    const rentalTimeConstraints: RentalTimeConstraints = {
      minDays: row.minRentalDaysSnapshot,
      maxDays: row.maxRentalDaysSnapshot ?? undefined,
    };
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
      walletProvider: (row.walletProvider as any) ?? null,
      contractAcceptedAt: row.contractAcceptedAt,
      paidAt: row.paidAt,
      voucherToken: row.voucherToken,
      returnQrToken: row.returnQrToken,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      rejectionReason: row.rejectionReason,
      transferExpiresAt: row.transferExpiresAt,
      transferCode: row.transferCode,
      transferAlias: row.transferAlias,
      transferPaymentMode:
        (row.transferPaymentMode as 'full' | 'deposit' | 'balance' | null) ?? null,
      depositPaidCents: row.depositPaidCents,
      depositPaidAt: row.depositPaidAt,
      balanceDueAt: row.balanceDueAt,
      balanceReminderSentAt: row.balanceReminderSentAt,
      depositPercentageSnapshot: row.depositPercentageSnapshot,
      basePriceCentsSnapshot: row.basePriceCentsSnapshot,
      cancellationPolicySnapshot: row.cancellationPolicySnapshot as CancellationPolicy,
      maxKilometrageSnapshot: maxKilometrage,
      rentalTimeConstraintsSnapshot: rentalTimeConstraints,
      withHomeDelivery: row.withHomeDelivery,
      homeDeliveryFeeCentsSnapshot: row.homeDeliveryFeeCentsSnapshot,
      deliveryAddress:
        row.deliveryAddress !== null && row.deliveryLatitude !== null && row.deliveryLongitude !== null
          ? { address: row.deliveryAddress, latitude: row.deliveryLatitude, longitude: row.deliveryLongitude }
          : null,
      withHomeReturn: row.withHomeReturn,
      homeReturnFeeCentsSnapshot: row.homeReturnFeeCentsSnapshot,
      returnAddress:
        row.returnAddress !== null && row.returnLatitude !== null && row.returnLongitude !== null
          ? { address: row.returnAddress, latitude: row.returnLatitude, longitude: row.returnLongitude }
          : null,
      parentReservationId: row.parentReservationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
