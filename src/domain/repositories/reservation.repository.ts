import {
  Reservation,
  ReservationStatus,
} from '../entities/reservation.entity';

export type ReservationRole = 'conductor' | 'owner';

export interface ReservationListFilters {
  status?: ReservationStatus[];
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface ReservationListResult {
  items: Reservation[];
  total: number;
}

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
  findActiveByVehicleId(
    vehicleId: string,
    statuses: ReservationStatus[],
  ): Promise<Reservation[]>;
  /**
   * Lista reservas desde la perspectiva de un usuario (conductor o owner).
   * Paginado, con filtros opcionales por estado y rango de fechas (sobre `startAt`).
   */
  findByUser(
    userId: string,
    role: ReservationRole,
    filters: ReservationListFilters,
  ): Promise<ReservationListResult>;
}

export const RESERVATION_REPOSITORY = Symbol('ReservationRepository');
