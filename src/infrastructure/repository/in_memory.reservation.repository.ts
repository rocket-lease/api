import { Injectable } from '@nestjs/common';
import {
  Reservation,
  ReservationStatus,
  RESERVATION_STATUS,
} from '@/domain/entities/reservation.entity';
import {
  ReservationRepository,
  ReservationListFilters,
  ReservationListResult,
  ReservationRole,
} from '@/domain/repositories/reservation.repository';

@Injectable()
export class InMemoryReservationRepository implements ReservationRepository {
  private readonly store = new Map<string, Reservation>();

  async save(reservation: Reservation): Promise<Reservation> {
    if (
      reservation.getStatus() === 'pending_payment' ||
      reservation.getStatus() === 'confirmed' ||
      reservation.getStatus() === 'in_progress'
    ) {
      const overlapping = await this.findOverlapping(
        reservation.getVehicleId(),
        reservation.getStartAt(),
        reservation.getEndAt(),
        ['pending_payment', 'confirmed', 'in_progress'],
      );
      const conflicting = overlapping.find(
        (r) => r.getId() !== reservation.getId(),
      );
      if (conflicting) {
        const err = new Error('reservations_no_overlap');
        (err as { code?: string }).code = '23P01';
        throw err;
      }
    }
    this.store.set(reservation.getId(), reservation);
    return reservation;
  }

  async update(reservation: Reservation): Promise<Reservation> {
    this.store.set(reservation.getId(), reservation);
    return reservation;
  }

  async findById(id: string): Promise<Reservation | null> {
    return this.store.get(id) ?? null;
  }

  async findByVoucherToken(token: string): Promise<Reservation | null> {
    return Array.from(this.store.values()).find((r) => r.getVoucherToken() === token) ?? null;
  }

  async findByReturnQrToken(token: string): Promise<Reservation | null> {
    return Array.from(this.store.values()).find((r) => r.getReturnQrToken() === token) ?? null;
  }

  async findOverlapping(
    vehicleId: string,
    startAt: Date,
    endAt: Date,
    statuses: ReservationStatus[],
  ): Promise<Reservation[]> {
    return Array.from(this.store.values()).filter(
      (r) =>
        r.getVehicleId() === vehicleId &&
        statuses.includes(r.getStatus()) &&
        r.getStartAt().getTime() < endAt.getTime() &&
        r.getEndAt().getTime() > startAt.getTime(),
    );
  }

  async findExpiredHolds(now: Date): Promise<Reservation[]> {
    return Array.from(this.store.values()).filter(
      (r) =>
        r.getStatus() === 'pending_payment' &&
        r.getHoldExpiresAt() !== null &&
        r.getHoldExpiresAt()!.getTime() <= now.getTime(),
    );
  }

  async findApprovalExpiredBefore(cutoff: Date): Promise<Reservation[]> {
    return Array.from(this.store.values()).filter(
      (r) =>
        r.getStatus() === 'pending_approval' &&
        r.getCreatedAt().getTime() <= cutoff.getTime(),
    );
  }

  async findOverlappingPendingApproval(
    vehicleId: string,
    startAt: Date,
    endAt: Date,
    excludeId: string,
  ): Promise<Reservation[]> {
    return Array.from(this.store.values()).filter(
      (r) =>
        r.getVehicleId() === vehicleId &&
        r.getStatus() === 'pending_approval' &&
        r.getId() !== excludeId &&
        r.getStartAt().getTime() < endAt.getTime() &&
        r.getEndAt().getTime() > startAt.getTime(),
    );
  }

  async approveWithCascade(
    approved: Reservation,
    cascadedRejections: Reservation[],
  ): Promise<void> {
    // Emulación del EXCLUDE constraint de Postgres: la implementación real lo
    // delega a la DB, pero este Map no tiene constraints, así que el fake debe
    // chequear el conflicto manualmente para mantener paridad de comportamiento
    // con `PostgresReservationRepository` (mismo error code 23P01).
    const wouldConflict = (await this.findOverlapping(
      approved.getVehicleId(),
      approved.getStartAt(),
      approved.getEndAt(),
      ['pending_payment', 'confirmed', 'in_progress'],
    )).find((r) => r.getId() !== approved.getId());
    if (wouldConflict) {
      const err = new Error('reservations_no_overlap');
      (err as { code?: string }).code = '23P01';
      throw err;
    }
    this.store.set(approved.getId(), approved);
    for (const r of cascadedRejections) {
      this.store.set(r.getId(), r);
    }
  }

  async findExpiredTransfers(now: Date): Promise<Reservation[]> {
    return Array.from(this.store.values()).filter(
      (r) =>
        r.getStatus() === 'pending_approval' &&
        r.getTransferExpiresAt() !== null &&
        r.getTransferExpiresAt()!.getTime() <= now.getTime(),
    );
  }

  async findActiveByVehicleId(
    vehicleId: string,
    statuses: ReservationStatus[],
  ): Promise<Reservation[]> {
    return Array.from(this.store.values()).filter(
      (r) =>
        r.getVehicleId() === vehicleId && statuses.includes(r.getStatus()),
    );
  }

  async findByUser(
    userId: string,
    role: ReservationRole,
    filters: ReservationListFilters,
  ): Promise<ReservationListResult> {
    const matchesRole = (r: Reservation) =>
      role === 'conductor'
        ? r.getConductorId() === userId
        : r.getRentadorId() === userId;
    const all = Array.from(this.store.values()).filter((r) => {
      if (!matchesRole(r)) return false;
      if (filters.status && filters.status.length > 0) {
        if (!filters.status.includes(r.getStatus())) return false;
      }
      if (filters.from && r.getStartAt().getTime() < filters.from.getTime()) {
        return false;
      }
      if (filters.to && r.getStartAt().getTime() > filters.to.getTime()) {
        return false;
      }
      return true;
    });
    all.sort((a, b) => b.getCreatedAt().getTime() - a.getCreatedAt().getTime());
    const start = (filters.page - 1) * filters.pageSize;
    return {
      items: all.slice(start, start + filters.pageSize),
      total: all.length,
    };
  }

  async hasActiveReservations(userId: string): Promise<boolean> {
    return Array.from(this.store.values()).some(
      (r) =>
        (r.getConductorId() === userId || r.getRentadorId() === userId) &&
        ([RESERVATION_STATUS.confirmed, RESERVATION_STATUS.in_progress, RESERVATION_STATUS.pending_payment] as ReservationStatus[]).includes(r.getStatus()),
    )
  }

  async findChain(reservationId: string): Promise<Reservation[]> {
    const start = this.store.get(reservationId);
    if (!start) return [];
    let root: Reservation = start;
    while (root.getParentReservationId()) {
      const next = this.store.get(root.getParentReservationId()!);
      if (!next) break;
      root = next;
    }
    const all = Array.from(this.store.values());
    const collected: Reservation[] = [];
    const queue: Reservation[] = [root];
    while (queue.length > 0) {
      const current = queue.shift()!;
      collected.push(current);
      for (const r of all) {
        if (r.getParentReservationId() === current.getId()) {
          queue.push(r);
        }
      }
    }
    collected.sort((a, b) => a.getStartAt().getTime() - b.getStartAt().getTime());
    return collected;
  }

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
    for (const r of reservations) {
      this.store.set(r.getId(), r);
    }
  }

  // test helper
  clear() {
    this.store.clear();
  }
}
