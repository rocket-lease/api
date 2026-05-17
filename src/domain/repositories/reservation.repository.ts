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
  /**
   * Persiste una reserva nueva. Falla si la fila viola el EXCLUDE constraint
   * sobre `pending_payment` + `confirmed` + `in_progress` (solape de fechas).
   *
   * @param reservation - Entidad nueva (sin persistir previamente).
   * @returns La misma entidad rehidratada con los timestamps definitivos de DB.
   */
  save(reservation: Reservation): Promise<Reservation>;

  /**
   * Actualiza una reserva existente. Asume que `reservation` ya pasó por
   * `findById` y conserva su `id`. Se usa para todas las transiciones de estado.
   *
   * @param reservation - Entidad con cambios aplicados en memoria.
   * @returns La entidad rehidratada con `updatedAt` actualizado por DB.
   */
  update(reservation: Reservation): Promise<Reservation>;

  /**
   * Busca una reserva por id.
   *
   * @param id - UUID de la reserva.
   * @returns La entidad si existe, `null` si no.
   */
  findById(id: string): Promise<Reservation | null>;

  /**
   * Devuelve las reservas del vehículo cuyas fechas se solapan con el rango y
   * cuyo status está en `statuses`. Se usa al crear una reserva para chequear
   * disponibilidad antes de insertar (chequeo defensivo: el EXCLUDE constraint
   * es la garantía dura).
   *
   * @param vehicleId - ID del vehículo.
   * @param startAt - Inicio del rango a chequear.
   * @param endAt - Fin del rango a chequear (exclusivo).
   * @param statuses - Status que cuentan como "ocupado" (típicamente `BLOCKING_STATUSES`).
   * @returns Lista de reservas solapadas. Vacía si no hay conflicto.
   */
  findOverlapping(
    vehicleId: string,
    startAt: Date,
    endAt: Date,
    statuses: ReservationStatus[],
  ): Promise<Reservation[]>;

  /**
   * Devuelve las reservas `pending_payment` cuyo `holdExpiresAt <= now`. Las
   * recoge el job de expiración para marcarlas como `expired` y liberar el slot.
   *
   * @param now - Instante actual del clock inyectado.
   * @returns Lista de reservas con hold vencido.
   */
  findExpiredHolds(now: Date): Promise<Reservation[]>;

  /**
   * Devuelve las solicitudes `pending_approval` cuya antigüedad (`createdAt`)
   * supera el `cutoff` calculado (`now - APPROVAL_TTL_MS`). Las recoge el job
   * de expiración para liberar el slot del vehículo.
   *
   * @param cutoff - Timestamp límite: reservas creadas antes de este instante
   *   se consideran expiradas.
   * @returns Lista de solicitudes `pending_approval` vencidas.
   */
  findApprovalExpiredBefore(cutoff: Date): Promise<Reservation[]>;

  /**
   * Devuelve las reservas del vehículo en los `statuses` dados, sin filtro de
   * fechas. Se usa para cancelación en cascada al deshabilitar/eliminar el
   * vehículo (`cancelPendingByVehicle`).
   *
   * @param vehicleId - ID del vehículo.
   * @param statuses - Status que cuentan como "activos" para la operación que llama.
   * @returns Lista de reservas matcheando los criterios.
   */
  findActiveByVehicleId(
    vehicleId: string,
    statuses: ReservationStatus[],
  ): Promise<Reservation[]>;

  /**
   * Busca otras solicitudes `pending_approval` del mismo vehículo cuyas fechas
   * se solapan con el rango dado. Se usa para el auto-rechazo en cascada al
   * aprobar una solicitud (excluye la solicitud que se está aprobando).
   *
   * @param vehicleId - ID del vehículo.
   * @param startAt - Inicio del rango aprobado.
   * @param endAt - Fin del rango aprobado (exclusivo).
   * @param excludeId - ID de la solicitud que se está aprobando (no se incluye
   *   en el resultado aunque también esté `pending_approval`).
   * @returns Lista de solicitudes solapadas a auto-rechazar.
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
   * @param approved - Reserva que el rentador aprobó (ya transicionada a
   *   `pending_payment` en memoria).
   * @param cascadedRejections - Reservas solapadas a rechazar (ya transicionadas
   *   a `rejected` en memoria con razón autogenerada).
   * @returns `void` — las entidades de entrada quedan persistidas; el caller no
   *   recibe rehidratación porque ya tiene los IDs y status finales.
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
