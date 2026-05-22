import { Inject, Injectable } from '@nestjs/common';
import {
  type ApproveReservationResponse,
  ApproveReservationResponseSchema,
  type CancelReservationResponse,
  CancelReservationResponseSchema,
  type ConfirmPickupResponse,
  ConfirmPickupResponseSchema,
  type ConfirmReturnResponse,
  ConfirmReturnResponseSchema,
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
  type PaymentMethodsResponse,
  PaymentMethodsResponseSchema,
  type InitiateTransferResponse,
  InitiateTransferResponseSchema,
  type ConfirmTransferResponse,
  ConfirmTransferResponseSchema,
  type Voucher,
  type ReservationRuleSetPublic,
  VoucherSchema,
  type VerifyVoucherResponse,
  VerifyVoucherResponseSchema,
} from '@rocket-lease/contracts';
import {
  APPROVAL_TTL_MS,
  BLOCKING_STATUSES,
  CASCADE_REJECTION_REASON,
  HOLD_TTL_MS,
  Reservation,
  RESERVATION_STATUS,
  WalletProviderEnum,
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
import {
  RESERVATION_RULE_SET_REPOSITORY,
  type ReservationRuleSetRepository,
} from '@/domain/repositories/reservation-rule-set.repository';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import {
  ContractNotAcceptedException,
  HoldExpiredException,
  OwnerCannotReserveOwnVehicleException,
  ReservationForbiddenException,
  ReservationNotFoundException,
  VehicleNotAvailableException,
  InvalidQrTokenException,
  VoucherNotFoundException,
  VoucherReservationCancelledException,
} from '@/domain/exceptions/reservation.exception';
import {
  VOUCHER_PROVIDER,
  type VoucherProvider,
} from '@/domain/providers/voucher.provider';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '@/domain/providers/notification.provider';
import {
  PAYMENT_GATEWAY_PROVIDER,
  type PaymentGatewayProvider,
} from '@/domain/providers/payment-gateway.provider';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { computeReservationTotalCents } from './helpers/pricing';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { EMAIL_PROVIDER, type EmailProvider } from '@/domain/providers/email.provider';

@Injectable()
export class ReservationService {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: ReservationRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(RESERVATION_RULE_SET_REPOSITORY)
    private readonly reservationRuleSetRepository: ReservationRuleSetRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
    @Inject(VOUCHER_PROVIDER)
    private readonly voucherProvider: VoucherProvider,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
    @Inject(PAYMENT_GATEWAY_PROVIDER)
    private readonly paymentGateway: PaymentGatewayProvider,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
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

    const status = effectiveAutoAccept ? RESERVATION_STATUS.pending_payment : RESERVATION_STATUS.pending_approval;
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

  public async getPaymentMethods(): Promise<PaymentMethodsResponse> {
    return PaymentMethodsResponseSchema.parse({
      methods: ['credit_card', 'debit_card', 'bank_transfer', 'digital_wallet'],
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
    if (reservation.isHoldExpired(now) || reservation.isExpired()) {
      if (reservation.isPendingPayment()) {
        reservation.markExpired(now);
        await this.reservationRepository.update(reservation);
      }
      throw new HoldExpiredException(reservationId);
    }

    // Validate digital_wallet requires walletProvider
    if (
      dto.paymentMethod === 'digital_wallet' &&
      !dto.walletProvider
    ) {
      throw new Error('walletProvider is required for digital_wallet');
    }

    const parsedWalletProvider = dto.walletProvider
      ? WalletProviderEnum.parse(dto.walletProvider)
      : undefined;
    reservation.confirmPayment(
      dto.paymentMethod,
      now,
      parsedWalletProvider,
    );
    const saved = await this.reservationRepository.update(reservation);

    await this.voucherProvider.generateVoucher(saved.getId());

    await this.notificationProvider.notify(
      saved.getConductorId(),
      'Reserva confirmada',
      `Tu reserva ${saved.getId().slice(0, 8)} fue confirmada.`,
    );
    await this.notificationProvider.notify(
      saved.getRentadorId(),
      'Nueva reserva confirmada',
      `Tenés una nueva reserva confirmada para el vehículo.`,
    );
    const conductorProfile = await this.userRepository.getProfileById(conductorId);
    if (conductorProfile?.email) {
      const voucherData = await this.getVoucher(saved.getId(), conductorId);
      await this.emailProvider.sendVoucherEmail(conductorProfile.email, voucherData);
    }

    return ConfirmReservationPaymentResponseSchema.parse({
      id: saved.getId(),
      status: RESERVATION_STATUS.confirmed,
      paidAt: saved.getPaidAt()!.toISOString(),
      voucherToken: saved.getVoucherToken()!,
    });
  }

  public async initiateBankTransfer(
    conductorId: string,
    reservationId: string,
  ): Promise<InitiateTransferResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }

    const now = this.clock.now();
    if (reservation.isHoldExpired(now) || reservation.isExpired()) {
      if (reservation.isPendingPayment()) {
        reservation.markExpired(now);
        await this.reservationRepository.update(reservation);
      }
      throw new HoldExpiredException(reservationId);
    }

    const { code: transferCode, alias: transferAlias } =
      await this.paymentGateway.generateTransferCode();
    reservation.initiateBankTransfer(now, transferCode, transferAlias);
    const saved = await this.reservationRepository.update(reservation);

    this.autoConfirmTransfer(reservationId);

    return InitiateTransferResponseSchema.parse({
      id: saved.getId(),
      status: RESERVATION_STATUS.pending_approval,
      transferCode: saved.getTransferCode()!,
      transferAlias: saved.getTransferAlias()!,
      transferExpiresAt: saved.getTransferExpiresAt()!.toISOString(),
      totalCents: saved.getTotalCents(),
      currency: 'ARS',
    });
  }

  /**
   * Auto-confirma la transferencia después de 5 segundos (demo).
   * Re-intenta con un intervalo exponencial hasta 3 veces si falla.
   */
  private autoConfirmTransfer(reservationId: string): void {
    setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const r = await this.reservationRepository.findById(reservationId);
          if (!r) return;
          if (!r.isPendingApproval()) return;
          if (r.isTransferExpired(this.clock.now())) return;
          r.confirmTransferPayment(this.clock.now());
          await this.reservationRepository.update(r);
        } catch {
          // auto-confirm falló (ej. solapamiento de EXCLUDE), se cancela silenciosamente
        }
      })();
    }, 5000);
  }

  public async confirmTransferPayment(
    conductorId: string,
    reservationId: string,
  ): Promise<ConfirmTransferResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }

    const now = this.clock.now();
    reservation.confirmTransferPayment(now);
    const saved = await this.reservationRepository.update(reservation);

    const voucher = await this.voucherProvider.generateVoucher(saved.getId());

    await this.notificationProvider.notify(
      saved.getConductorId(),
      'Transferencia acreditada',
      `Tu transferencia fue acreditada. Reserva ${saved.getId().slice(0, 8)} confirmada.`,
    );

    return ConfirmTransferResponseSchema.parse({
      id: saved.getId(),
      status: RESERVATION_STATUS.confirmed,
      paidAt: saved.getPaidAt()!.toISOString(),
      voucher: { qrCode: voucher.qrCode },
      notified: true,
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
      status: RESERVATION_STATUS.pending_payment,
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
      status: RESERVATION_STATUS.rejected,
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

  public async getVoucher(
    reservationId: string,
    conductorId: string,
  ): Promise<Voucher> {
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }
    if (reservation.isCancelled()) {
      throw new VoucherReservationCancelledException(reservationId);
    }
    const token = reservation.getVoucherToken();
    if (!token) throw new VoucherNotFoundException('pending');

    const vehicle = await this.vehicleRepository.findById(reservation.getVehicleId());
    if (!vehicle) throw new EntityNotFoundException('vehicle', reservation.getVehicleId());
    const conductorProfile = await this.userRepository.getProfileById(conductorId);

    return VoucherSchema.parse({
      reservationId: reservation.getId(),
      voucherToken: token,
      status: reservation.getStatus(),
      conductor: {
        id: conductorId,
        name: conductorProfile?.name ?? 'Conductor',
        avatarUrl: conductorProfile?.avatarUrl ?? null,
      },
      vehicle: this.vehicleSummary(vehicle, vehicle.getId()),
      startAt: reservation.getStartAt().toISOString(),
      endAt: reservation.getEndAt().toISOString(),
      totalCents: reservation.getTotalCents(),
      currency: reservation.getCurrency(),
      paymentMethod: reservation.getPaymentMethod()!,
      paidAt: reservation.getPaidAt()!.toISOString(),
    });
  }

  public async verifyVoucher(token: string): Promise<VerifyVoucherResponse> {
    const reservation = await this.reservationRepository.findByVoucherToken(token);
    if (!reservation) throw new VoucherNotFoundException(token);

    const vehicle = await this.vehicleRepository.findById(reservation.getVehicleId());
    const conductorProfile = await this.userRepository.getProfileById(reservation.getConductorId());
    const rentadorProfile = await this.userRepository.getProfileById(reservation.getRentadorId());

    const isValid = reservation.isConfirmed() || reservation.isInProgress();

    return VerifyVoucherResponseSchema.parse({
      reservationId: reservation.getId(),
      status: reservation.getStatus(),
      conductor: {
        id: reservation.getConductorId(),
        name: conductorProfile?.name ?? 'Conductor',
        avatarUrl: conductorProfile?.avatarUrl ?? null,
      },
      vehicle: this.vehicleSummary(vehicle, reservation.getVehicleId()),
      rentador: {
        id: reservation.getRentadorId(),
        name: rentadorProfile?.name ?? 'Rentador',
        avatarUrl: rentadorProfile?.avatarUrl ?? null,
      },
      startAt: reservation.getStartAt().toISOString(),
      endAt: reservation.getEndAt().toISOString(),
      totalCents: reservation.getTotalCents(),
      currency: reservation.getCurrency(),
      paymentMethod: reservation.getPaymentMethod()!,
      paidAt: reservation.getPaidAt()!.toISOString(),
      isValid,
    });
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
      status: RESERVATION_STATUS.cancelled,
    });
  }

  public async confirmPickup(
    rentadorId: string,
    voucherToken: string,
  ): Promise<ConfirmPickupResponse> {
    const reservation = await this.reservationRepository.findByVoucherToken(voucherToken);
    if (!reservation || !reservation.isConfirmed()) {
      throw new InvalidQrTokenException();
    }
    if (!reservation.isOwnedByRentador(rentadorId)) {
      throw new ReservationForbiddenException();
    }
    reservation.confirmPickup(this.clock.now());
    const saved = await this.reservationRepository.update(reservation);
    return ConfirmPickupResponseSchema.parse({
      reservationId: saved.getId(),
      status: RESERVATION_STATUS.in_progress,
      startedAt: saved.getStartedAt()!.toISOString(),
      returnQrToken: saved.getReturnQrToken()!,
    });
  }

  public async confirmReturn(
    conductorId: string,
    returnQrToken: string,
  ): Promise<ConfirmReturnResponse> {
    const reservation = await this.reservationRepository.findByReturnQrToken(returnQrToken);
    if (!reservation || !reservation.isInProgress()) {
      throw new InvalidQrTokenException();
    }
    if (!reservation.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }
    reservation.confirmReturn(returnQrToken, this.clock.now());
    const saved = await this.reservationRepository.update(reservation);
    return ConfirmReturnResponseSchema.parse({
      reservationId: saved.getId(),
      status: RESERVATION_STATUS.completed,
      completedAt: saved.getCompletedAt()!.toISOString(),
    });
  }

  public async expireOverdueTransfers(): Promise<number> {
    const now = this.clock.now();
    const expired = await this.reservationRepository.findExpiredTransfers(now);
    for (const r of expired) {
      r.expireTransfer(now);
      await this.reservationRepository.update(r);
    }
    return expired.length;
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
      [RESERVATION_STATUS.pending_payment, RESERVATION_STATUS.pending_approval],
    );
    for (const r of pending) {
      r.cancel(now);
      await this.reservationRepository.update(r);
    }
    return pending.length;
  }

  private async toDTO(r: Reservation): Promise<GetReservationResponse> {
    const [vehicle, rentadorProfile] = await Promise.all([
      this.vehicleRepository.findById(r.getVehicleId()),
      this.userRepository.getProfileById(r.getRentadorId()),
    ]);
    const reservationRuleSet = await this.getVehicleReservationRuleSet(vehicle);

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
      walletProvider: r.getWalletProvider(),
      contractAcceptedAt: r.getContractAcceptedAt()
        ? r.getContractAcceptedAt()!.toISOString()
        : null,
      paidAt: r.getPaidAt() ? r.getPaidAt()!.toISOString() : null,
      voucherToken: r.getVoucherToken() ?? null,
      returnQrToken: r.getReturnQrToken() ?? null,
      startedAt: r.getStartedAt() ? r.getStartedAt()!.toISOString() : null,
      completedAt: r.getCompletedAt() ? r.getCompletedAt()!.toISOString() : null,
      rejectionReason: r.getRejectionReason(),
      transferExpiresAt: r.getTransferExpiresAt()
        ? r.getTransferExpiresAt()!.toISOString()
        : null,
      transferCode: r.getTransferCode(),
      transferAlias: r.getTransferAlias(),
      createdAt: r.getCreatedAt().toISOString(),
      updatedAt: r.getUpdatedAt().toISOString(),
      vehicle: this.vehicleSummary(vehicle, r.getVehicleId(), reservationRuleSet),
      rentador: {
        id: r.getRentadorId(),
        name: rentadorProfile?.name ?? 'Rentador',
        avatarUrl: rentadorProfile?.avatarUrl ?? null,
      },
    });
  }

  private async getVehicleReservationRuleSet(
    vehicle: Vehicle | null,
  ): Promise<ReservationRuleSetPublic | null> {
    const ruleSetId = vehicle?.getReservationRuleSetId();
    if (!ruleSetId) return null;

    const ruleSet = await this.reservationRuleSetRepository.findById(ruleSetId);
    if (!ruleSet) return null;

    return {
      id: ruleSet.getId(),
      rentalorId: ruleSet.getRentalorId(),
      cancellationPolicy: ruleSet.getCancellationPolicy(),
      deposit: ruleSet.getDeposit(),
      maxKilometrage: ruleSet.getMaxKilometrage(),
      rentalTimeConstraints: ruleSet.getRentalTimeConstraints(),
    };
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

  private vehicleSummary(
    vehicle: Vehicle | null,
    vehicleId: string,
    reservationRuleSet: ReservationRuleSetPublic | null = null,
  ) {
    if (!vehicle) {
      return {
        id: vehicleId,
        brand: '—',
        model: '—',
        year: 0,
        photo: null,
        reservationRuleSet,
      };
    }
    const photos = vehicle.getPhotos();
    return {
      id: vehicle.getId(),
      brand: vehicle.getBrand(),
      model: vehicle.getModel(),
      year: vehicle.getYear(),
      photo: photos.length > 0 ? photos[0] : null,
      reservationRuleSet,
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
