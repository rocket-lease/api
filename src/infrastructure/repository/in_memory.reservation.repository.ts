import { Injectable } from '@nestjs/common';
import {
  Reservation,
  ReservationStatus,
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

  // test helper
  clear() {
    this.store.clear();
  }
}
