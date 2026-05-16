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
  /**
   * Devuelve las solicitudes `pending_approval` cuya antigüedad (createdAt)
   * supera el `cutoff` calculado (`now - APPROVAL_TTL_MS`). Las recoge el job
   * de expiración para liberar el slot del vehículo.
   */
  findApprovalExpiredBefore(cutoff: Date): Promise<Reservation[]>;
  findActiveByVehicleId(
    vehicleId: string,
    statuses: ReservationStatus[],
  ): Promise<Reservation[]>;
  /**
   * Busca otras solicitudes `pending_approval` del mismo vehículo cuyas fechas
   * se solapan con el rango dado. Se usa para el auto-rechazo en cascada al
   * aprobar una solicitud (excluye la solicitud que se está aprobando).
   */
  findOverlappingPendingApproval(
    vehicleId: string,
    startAt: Date,
    endAt: Date,
    excludeId: string,
  ): Promise<Reservation[]>;
  /**
   * Ejecuta la aprobación de una solicitud + el rechazo en cascada de las
   * solicitudes solapadas en una sola transacción atómica. Si alguna falla
   * (incluido el EXCLUDE constraint sobre `pending_payment`), nada se persiste.
   *
   * @returns El número de solicitudes solapadas que quedaron rechazadas.
   */
  approveWithCascade(
    approved: Reservation,
    cascadedRejections: Reservation[],
  ): Promise<void>;
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
