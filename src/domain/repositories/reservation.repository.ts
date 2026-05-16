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
   * Lista las reservas en las que participa un usuario, desde la perspectiva indicada.
   *
   * @param userId - ID del usuario cuyas reservas se quieren listar.
   * @param role - Lado del usuario en la reserva: `'conductor'` filtra por `conductor_id`,
   *   `'owner'` filtra por `rentador_id` (= dueño del vehículo reservado).
   * @param filters - Filtros opcionales (`status[]`, rango `from`/`to` sobre `startAt`)
   *   más paginación obligatoria (`page`, `pageSize`).
   * @returns Página de reservas ordenadas por `createdAt` desc más el `total` global
   *   matcheando los filtros (independiente de la página).
   */
  findByUser(
    userId: string,
    role: ReservationRole,
    filters: ReservationListFilters,
  ): Promise<ReservationListResult>;
}

export const RESERVATION_REPOSITORY = Symbol('ReservationRepository');
