import { Inject, Injectable } from '@nestjs/common';
import {
  type ApproveReservationResponse,
  ApproveReservationResponseSchema,
  type CancelReservationResponse,
  CancelReservationResponseSchema,
  type CreateReservationRequest,
  type CreateReservationResponse,
  CreateReservationResponseSchema,
  type ConfirmReservationPaymentRequest,
  type ConfirmReservationPaymentResponse,
  ConfirmReservationPaymentResponseSchema,
  type GetReservationResponse,
  GetReservationResponseSchema,
  type RejectReservationResponse,
  RejectReservationResponseSchema,
  type VehicleBusyRangesResponse,
  VehicleBusyRangesResponseSchema,
  type ReservationListItem,
  type ReservationsListRequest,
  type ReservationsListResponse,
  ReservationsListResponseSchema,
} from '@rocket-lease/contracts';
import {
  APPROVAL_TTL_MS,
  BLOCKING_STATUSES,
  CASCADE_REJECTION_REASON,
  HOLD_TTL_MS,
  Reservation,
} from '@/domain/entities/reservation.entity';
import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '@/domain/repositories/reservation.repository';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepository,
} from '@/domain/repositories/vehicle.repository';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import {
  ContractNotAcceptedException,
  HoldExpiredException,
  OwnerCannotReserveOwnVehicleException,
  ReservationForbiddenException,
  ReservationNotFoundException,
  VehicleNotAvailableException,
} from '@/domain/exceptions/reservation.exception';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { computeReservationTotalCents } from './helpers/pricing';
import { Vehicle } from '@/domain/entities/vehicle.entity';

@Injectable()
export class ReservationService {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: ReservationRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  /**
   * Crea una reserva. Si el vehículo (o, por herencia, su owner) tiene
   * `autoAccept = true`, la reserva entra directo a `pending_payment` con hold
   * de 10 min para pagar. Si no, entra a `pending_approval` con TTL de 24h para
   * que el rentador decida.
   *
   * @param conductorId - ID del conductor autenticado (extraído del JWT por el
   *   controller, nunca del body — el conductor no puede crear reservas a nombre
   *   de otro).
   * @param dto - Payload validado: vehicleId, startAt, endAt, contractAccepted.
   * @returns Resumen con id, status inicial (`pending_payment` o `pending_approval`),
   *   `holdExpiresAt` (10 min o 24h según el flujo) y total cents.
   */
  public async createReservation(
    conductorId: string,
    dto: CreateReservationRequest,
  ): Promise<CreateReservationResponse> {
    const vehicle = await this.vehicleRepository.findById(dto.vehicleId);
    if (!vehicle) throw new EntityNotFoundException('vehicle', dto.vehicleId);
    if (!vehicle.isEnabled()) {
      throw new VehicleNotAvailableException(dto.vehicleId);
    }
    if (vehicle.isOwnedBy(conductorId)) {
      throw new OwnerCannotReserveOwnVehicleException(dto.vehicleId);
    }
    if (dto.contractAccepted !== true) {
      throw new ContractNotAcceptedException();
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    const now = this.clock.now();

    const overlapping = await this.reservationRepository.findOverlapping(
      vehicle.getId(),
      startAt,
      endAt,
      BLOCKING_STATUSES,
    );
    if (overlapping.length > 0) {
      throw new VehicleNotAvailableException(vehicle.getId());
    }

    const ownerProfile = await this.userRepository.getProfileById(
      vehicle.getOwnerId(),
    );
    const effectiveAutoAccept =
      vehicle.getAutoAccept() ?? ownerProfile?.autoAccept ?? false;

    const totalCents = computeReservationTotalCents(
      vehicle.getBasePriceCents(),
      startAt,
      endAt,
    );

    const status = effectiveAutoAccept ? 'pending_payment' : 'pending_approval';
    const ttlMs = effectiveAutoAccept ? HOLD_TTL_MS : APPROVAL_TTL_MS;

    const reservation = new Reservation({
      vehicleId: vehicle.getId(),
      conductorId,
      rentadorId: vehicle.getOwnerId(),
      status,
      startAt,
      endAt,
      holdExpiresAt: new Date(now.getTime() + ttlMs),
      totalCents,
      currency: 'ARS',
      paymentMethod: null,
      contractAcceptedAt: now,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    });

    let saved: Reservation;
    try {
      saved = await this.reservationRepository.save(reservation);
    } catch (e) {
      if (isExclusionViolation(e)) {
        throw new VehicleNotAvailableException(vehicle.getId());
      }
      throw e;
    }

    return CreateReservationResponseSchema.parse({
      id: saved.getId(),
      status: saved.getStatus(),
      holdExpiresAt: saved.getHoldExpiresAt()!.toISOString(),
      totalCents: saved.getTotalCents(),
      currency: 'ARS',
    });
  }

  public async confirmPayment(
    conductorId: string,
    reservationId: string,
    dto: ConfirmReservationPaymentRequest,
  ): Promise<ConfirmReservationPaymentResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }

    const now = this.clock.now();
    if (reservation.isHoldExpired(now) || reservation.getStatus() === 'expired') {
      if (reservation.getStatus() === 'pending_payment') {
        reservation.markExpired(now);
        await this.reservationRepository.update(reservation);
      }
      throw new HoldExpiredException(reservationId);
    }

    reservation.confirmPayment(dto.paymentMethod, now);
    const saved = await this.reservationRepository.update(reservation);

    return ConfirmReservationPaymentResponseSchema.parse({
      id: saved.getId(),
      status: 'confirmed',
      paidAt: saved.getPaidAt()!.toISOString(),
    });
  }

  /**
   * El rentador aprueba una solicitud `pending_approval`. La reserva pasa a
   * `pending_payment` (hold de 10 min) y, en la misma transacción, las demás
   * solicitudes `pending_approval` del mismo vehículo cuyas fechas se solapan
   * quedan auto-rechazadas con una razón autogenerada (concurrencia permisiva:
   * el `pending_approval` no consume el EXCLUDE constraint, así que aprobar es
   * lo que materializa la decisión).
   *
   * @param rentadorId - ID del rentador autenticado (extraído del JWT por el
   *   controller). Se valida que sea el dueño del vehículo: si no, 403.
   * @param reservationId - ID de la reserva a aprobar.
   * @returns Resumen con id, status (`pending_payment`) y nuevo `holdExpiresAt`.
   */
  public async approve(
    rentadorId: string,
    reservationId: string,
  ): Promise<ApproveReservationResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByRentador(rentadorId)) {
      throw new ReservationForbiddenException();
    }

    const now = this.clock.now();
    reservation.approve(now);

    const overlapping =
      await this.reservationRepository.findOverlappingPendingApproval(
        reservation.getVehicleId(),
        reservation.getStartAt(),
        reservation.getEndAt(),
        reservation.getId(),
      );
    for (const r of overlapping) {
      r.reject(CASCADE_REJECTION_REASON, now);
    }

    try {
      await this.reservationRepository.approveWithCascade(
        reservation,
        overlapping,
      );
    } catch (e) {
      if (isExclusionViolation(e)) {
        throw new VehicleNotAvailableException(reservation.getVehicleId());
      }
      throw e;
    }

    return ApproveReservationResponseSchema.parse({
      id: reservation.getId(),
      status: 'pending_payment',
      holdExpiresAt: reservation.getHoldExpiresAt()!.toISOString(),
    });
  }

  /**
   * El rentador rechaza explícitamente una solicitud `pending_approval`. La
   * razón (opcional, max 280 chars validados en el contract) se persiste en
   * `rejectionReason`.
   *
   * @param rentadorId - ID del rentador autenticado (extraído del JWT). Se valida
   *   que sea el dueño del vehículo: si no, 403.
   * @param reservationId - ID de la reserva a rechazar.
   * @param reason - Motivo opcional. `null` o vacío se persiste como `null`.
   * @returns Resumen con id, status (`rejected`) y la razón persistida.
   */
  public async reject(
    rentadorId: string,
    reservationId: string,
    reason: string | null,
  ): Promise<RejectReservationResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByRentador(rentadorId)) {
      throw new ReservationForbiddenException();
    }

    const now = this.clock.now();
    reservation.reject(reason && reason.length > 0 ? reason : null, now);
    const saved = await this.reservationRepository.update(reservation);

    return RejectReservationResponseSchema.parse({
      id: saved.getId(),
      status: 'rejected',
      rejectionReason: saved.getRejectionReason(),
    });
  }

  public async getById(
    conductorId: string,
    reservationId: string,
  ): Promise<GetReservationResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (
      !reservation.isOwnedByConductor(conductorId) &&
      reservation.getRentadorId() !== conductorId
    ) {
      throw new ReservationForbiddenException();
    }
    return this.toDTO(reservation);
  }

  /**
   * Lista las reservas del usuario autenticado desde la perspectiva indicada.
   *
   * Hidrata `vehicle`, `conductor` y `rentador` en 3 queries fijas (1 reservas +
   * 2 batch `IN (...)`) sin importar `N`, evitando N+1.
   *
   * @param userId - ID del usuario autenticado (extraído del JWT por el controller,
   *   nunca del query string — garantiza que un usuario no pueda ver reservas ajenas).
   * @param dto - Rol (`conductor` u `owner`), filtros opcionales (`status[]`, `from`,
   *   `to`) y paginación.
   * @returns Página paginada con `items`, `page`, `pageSize` y `total` global.
   */
  public async list(
    userId: string,
    dto: ReservationsListRequest,
  ): Promise<ReservationsListResponse> {
    const { items, total } = await this.reservationRepository.findByUser(
      userId,
      dto.role,
      {
        status: dto.status,
        from: dto.from ? new Date(dto.from) : undefined,
        to: dto.to ? new Date(dto.to) : undefined,
        page: dto.page,
        pageSize: dto.pageSize,
      },
    );

    const vehicleIds = [...new Set(items.map((r) => r.getVehicleId()))];
    const userIds = [
      ...new Set([
        ...items.map((r) => r.getConductorId()),
        ...items.map((r) => r.getRentadorId()),
      ]),
    ];
    const [vehicles, users] = await Promise.all([
      this.vehicleRepository.findByIds(vehicleIds),
      this.userRepository.findProfilesByIds(userIds),
    ]);
    const vehicleById = new Map(vehicles.map((v) => [v.getId(), v]));
    const userById = new Map(users.map((u) => [u.id, u]));

    const dtos = items.map((r) =>
      this.toListItemDTO(
        r,
        vehicleById.get(r.getVehicleId()) ?? null,
        userById.get(r.getConductorId()) ?? null,
        userById.get(r.getRentadorId()) ?? null,
      ),
    );
    return ReservationsListResponseSchema.parse({
      items: dtos,
      page: dto.page,
      pageSize: dto.pageSize,
      total,
    });
  }

  public async getBusyRangesForVehicle(
    vehicleId: string,
  ): Promise<VehicleBusyRangesResponse> {
    const reservations =
      await this.reservationRepository.findActiveByVehicleId(
        vehicleId,
        BLOCKING_STATUSES,
      );
    const items = reservations.map((r) => ({
      startAt: r.getStartAt().toISOString(),
      endAt: r.getEndAt().toISOString(),
    }));
    return VehicleBusyRangesResponseSchema.parse({ items });
  }

  /**
   * Job de expiración periódico. Cubre dos casos:
   *  - holds de pago vencidos (`pending_payment` con `holdExpiresAt <= now`)
   *  - solicitudes `pending_approval` sin respuesta (>= 24h desde createdAt)
   *
   * Ambos pasan a `expired` y liberan el slot del vehículo.
   *
   * @returns Número total de reservas expiradas en esta corrida.
   */
  public async expireOverdueReservations(): Promise<number> {
    const now = this.clock.now();
    const expiredHolds = await this.reservationRepository.findExpiredHolds(now);
    for (const r of expiredHolds) {
      r.markExpired(now);
      await this.reservationRepository.update(r);
    }

    const cutoff = new Date(now.getTime() - APPROVAL_TTL_MS);
    const expiredApprovals =
      await this.reservationRepository.findApprovalExpiredBefore(cutoff);
    for (const r of expiredApprovals) {
      r.markApprovalExpired(now);
      await this.reservationRepository.update(r);
    }

    return expiredHolds.length + expiredApprovals.length;
  }

  /**
   * Cancela una reserva pendiente del conductor. Acepta tanto `pending_payment`
   * (hold de pago activo) como `pending_approval` (solicitud sin respuesta del
   * rentador — el conductor la retira).
   *
   * @param conductorId - ID del conductor autenticado (extraído del JWT). Se valida
   *   que sea el dueño de la reserva: si no, 403.
   * @param reservationId - ID de la reserva a cancelar.
   * @returns Resumen con id y status (`cancelled`).
   */
  public async cancelReservation(
    conductorId: string,
    reservationId: string,
  ): Promise<CancelReservationResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }

    const now = this.clock.now();
    reservation.cancel(now);
    const saved = await this.reservationRepository.update(reservation);

    return CancelReservationResponseSchema.parse({
      id: saved.getId(),
      status: 'cancelled',
    });
  }

  /**
   * Cancela en cascada todas las reservas pendientes (`pending_payment` y
   * `pending_approval`) de un vehículo. Se usa al deshabilitar o eliminar el
   * vehículo: las reservas confirmadas no se tocan (ya hay dinero y compromiso),
   * solo las que todavía no se materializaron.
   *
   * @param vehicleId - ID del vehículo cuyas reservas pendientes se cancelan.
   * @returns Cantidad de reservas canceladas en esta corrida.
   */
  public async cancelPendingByVehicle(vehicleId: string): Promise<number> {
    const now = this.clock.now();
    const pending = await this.reservationRepository.findActiveByVehicleId(
      vehicleId,
      ['pending_payment', 'pending_approval'],
    );
    for (const r of pending) {
      r.cancel(now);
      await this.reservationRepository.update(r);
    }
    return pending.length;
  }

  private async toDTO(r: Reservation): Promise<GetReservationResponse> {
    const vehicle = await this.vehicleRepository.findById(r.getVehicleId());
    const rentadorProfile = await this.userRepository.getProfileById(
      r.getRentadorId(),
    );
    return GetReservationResponseSchema.parse({
      id: r.getId(),
      vehicleId: r.getVehicleId(),
      conductorId: r.getConductorId(),
      rentadorId: r.getRentadorId(),
      status: r.getStatus(),
      startAt: r.getStartAt().toISOString(),
      endAt: r.getEndAt().toISOString(),
      holdExpiresAt: r.getHoldExpiresAt()
        ? r.getHoldExpiresAt()!.toISOString()
        : null,
      totalCents: r.getTotalCents(),
      currency: r.getCurrency(),
      paymentMethod: r.getPaymentMethod(),
      contractAcceptedAt: r.getContractAcceptedAt()
        ? r.getContractAcceptedAt()!.toISOString()
        : null,
      paidAt: r.getPaidAt() ? r.getPaidAt()!.toISOString() : null,
      rejectionReason: r.getRejectionReason(),
      createdAt: r.getCreatedAt().toISOString(),
      updatedAt: r.getUpdatedAt().toISOString(),
      vehicle: this.vehicleSummary(vehicle, r.getVehicleId()),
      rentador: {
        id: r.getRentadorId(),
        name: rentadorProfile?.name ?? 'Rentador',
        avatarUrl: rentadorProfile?.avatarUrl ?? null,
      },
    });
  }

  private toListItemDTO(
    r: Reservation,
    vehicle: Vehicle | null,
    conductorProfile: { name: string; avatarUrl: string | null } | null,
    rentadorProfile: { name: string; avatarUrl: string | null } | null,
  ): ReservationListItem {
    return {
      id: r.getId(),
      vehicleId: r.getVehicleId(),
      conductorId: r.getConductorId(),
      rentadorId: r.getRentadorId(),
      status: r.getStatus(),
      startAt: r.getStartAt().toISOString(),
      endAt: r.getEndAt().toISOString(),
      holdExpiresAt: r.getHoldExpiresAt()
        ? r.getHoldExpiresAt()!.toISOString()
        : null,
      totalCents: r.getTotalCents(),
      currency: r.getCurrency(),
      paymentMethod: r.getPaymentMethod(),
      paidAt: r.getPaidAt() ? r.getPaidAt()!.toISOString() : null,
      rejectionReason: r.getRejectionReason(),
      createdAt: r.getCreatedAt().toISOString(),
      updatedAt: r.getUpdatedAt().toISOString(),
      vehicle: this.vehicleSummary(vehicle, r.getVehicleId()),
      conductor: {
        id: r.getConductorId(),
        name: conductorProfile?.name ?? 'Conductor',
        avatarUrl: conductorProfile?.avatarUrl ?? null,
      },
      rentador: {
        id: r.getRentadorId(),
        name: rentadorProfile?.name ?? 'Rentador',
        avatarUrl: rentadorProfile?.avatarUrl ?? null,
      },
    };
  }

  private vehicleSummary(vehicle: Vehicle | null, vehicleId: string) {
    if (!vehicle) {
      return {
        id: vehicleId,
        brand: '—',
        model: '—',
        year: 0,
        photo: null,
      };
    }
    const photos = vehicle.getPhotos();
    return {
      id: vehicle.getId(),
      brand: vehicle.getBrand(),
      model: vehicle.getModel(),
      year: vehicle.getYear(),
      photo: photos.length > 0 ? photos[0] : null,
    };
  }
}

function isExclusionViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const anyE = e as { code?: string; meta?: { code?: string } };
  if (anyE.code === '23P01') return true;
  if (anyE.meta?.code === '23P01') return true;
  const msg = (e as Error).message ?? '';
  return msg.includes('reservations_no_overlap');
}
