import { Injectable } from '@nestjs/common';
import {
  Reservation,
  ReservationStatus,
} from '@/domain/entities/reservation.entity';
import {
  ReservationRepository,
  RentadorListFilters,
  RentadorListResult,
} from '@/domain/repositories/reservation.repository';

@Injectable()
export class InMemoryReservationRepository implements ReservationRepository {
  private readonly store = new Map<string, Reservation>();

  async save(reservation: Reservation): Promise<Reservation> {
    const overlapping = await this.findOverlapping(
      reservation.getVehicleId(),
      reservation.getStartAt(),
      reservation.getEndAt(),
      ['pending_payment', 'confirmed', 'in_progress'],
    );
    const conflicting = overlapping.find((r) => r.getId() !== reservation.getId());
    if (conflicting) {
      const err = new Error('reservations_no_overlap');
      (err as { code?: string }).code = '23P01';
      throw err;
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

  async findByConductorId(conductorId: string): Promise<Reservation[]> {
    return Array.from(this.store.values()).filter(
      (r) => r.getConductorId() === conductorId,
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

  async findByRentadorId(
    rentadorId: string,
    filters: RentadorListFilters,
  ): Promise<RentadorListResult> {
    const all = Array.from(this.store.values()).filter((r) => {
      if (r.getRentadorId() !== rentadorId) return false;
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
