import { Injectable } from '@nestjs/common';
import {
  Reservation,
  ReservationStatus,
} from '@/domain/entities/reservation.entity';
import { ReservationRepository } from '@/domain/repositories/reservation.repository';

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

  // test helper
  clear() {
    this.store.clear();
  }
}
