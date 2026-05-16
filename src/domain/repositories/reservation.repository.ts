import {
  Reservation,
  ReservationStatus,
} from '../entities/reservation.entity';

export interface ReservationRepository {
  save(reservation: Reservation): Promise<Reservation>;
  update(reservation: Reservation): Promise<Reservation>;
  findById(id: string): Promise<Reservation | null>;
  findOverlapping(
    vehicleId: string,
    startAt: Date,
    endAt: Date,
    statuses: ReservationStatus[],
  ): Promise<Reservation[]>;
  findExpiredHolds(now: Date): Promise<Reservation[]>;
  findByConductorId(conductorId: string): Promise<Reservation[]>;
  findActiveByVehicleId(
    vehicleId: string,
    statuses: ReservationStatus[],
  ): Promise<Reservation[]>;
}

export const RESERVATION_REPOSITORY = Symbol('ReservationRepository');
