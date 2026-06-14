import { Inject, Injectable, Logger } from '@nestjs/common';
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
  type ExtendReservationRequest,
  type ExtendReservationResponse,
  ExtendReservationResponseSchema,
  type GetReservationResponse,
  GetReservationResponseSchema,
  type RejectReservationResponse,
  RejectReservationResponseSchema,
  type ReservationChainItem,
  type VehicleBusyRangesResponse,
  VehicleBusyRangesResponseSchema,
  type ReservationListItem,
  type ReservationsListRequest,
  type ReservationsListResponse,
  ReservationsListResponseSchema,
  type PaymentMethodsResponse,
  PaymentMethodsResponseSchema,
  type InitiateTransferRequest,
  type InitiateTransferResponse,
  InitiateTransferResponseSchema,
  type ConfirmTransferResponse,
  ConfirmTransferResponseSchema,
  type ConfirmReservationBalanceRequest,
  type ConfirmReservationBalanceResponse,
  ConfirmReservationBalanceResponseSchema,
  type InitiateBalanceTransferResponse,
  InitiateBalanceTransferResponseSchema,
  type ConfirmBalanceTransferResponse,
  ConfirmBalanceTransferResponseSchema,
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
  RESERVATION_RULES_DEFAULTS,
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
  RESERVATION_RULE_SET_REPOSITORY,
  type ReservationRuleSetRepository,
} from '@/domain/repositories/reservation-rule-set.repository';
import { ReservationRuleSet } from '@/domain/entities/reservation-rule-set.entity';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import {
  ContractNotAcceptedException,
  ExtensionInvalidEndAtException,
  ExtensionNotPendingException,
  ExtensionParentNotInProgressException,
  PendingExtensionExistsException,
  HoldExpiredException,
  InvalidReservationTransitionException,
  OwnerCannotReserveOwnVehicleException,
  ReservationForbiddenException,
  ReservationNotFoundException,
  VehicleNotAvailableException,
  InvalidQrTokenException,
  VoucherNotFoundException,
  VoucherReservationCancelledException,
  CancelExtensionNotAllowedException,
  DepositNotAvailableException,
  BalanceNotDueException,
  VehicleHomeDeliveryNotEnabledException,
  VehicleHomeReturnNotEnabledException,
  HomeDeliveryAddressRequiredException,
  HomeReturnAddressRequiredException,
} from '@/domain/exceptions/reservation.exception';
import {
  PriceQuoteConductorMismatchException,
  PriceQuoteExpiredException,
  PriceQuoteNotFoundException,
  PriceQuoteVehicleMismatchException,
} from '@/domain/exceptions/domain.exception';
import {
  PRICE_QUOTE_REPOSITORY,
  type PriceQuoteRepository,
} from '@/domain/repositories/price-quote.repository';
import { PricingService } from '@/application/pricing/pricing.service';
import type { PricingQuote } from '@rocket-lease/contracts';
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
import {
  computeBaseRentalCents,
  computeDepositCents,
  computePricingQuote,
} from './helpers/pricing';
import { calculateCancellationRefund } from './helpers/cancellation-refund';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { EMAIL_PROVIDER, type EmailProvider } from '@/domain/providers/email.provider';
import { IdentityService } from '@/application/identity.service';
import { DriverLicenseService } from '@/application/driver-license.service';
import { WalletService } from '@/application/wallet.service';
import { ReputationService } from '@/application/reputation.service';
import { LoyaltyService } from '@/application/loyalty.service';

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

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
    @Inject(IdentityService)
    private readonly identityService: Pick<IdentityService, 'assertVerified'> = {
      assertVerified: async () => undefined,
    },
    @Inject(DriverLicenseService)
    private readonly driverLicenseService: Pick<DriverLicenseService, 'assertVerified'> = {
      assertVerified: async () => undefined,
    },
    @Inject(WalletService)
    private readonly walletService: Pick<WalletService, 'recordReservationPayout'> = {
      recordReservationPayout: async () => undefined,
    },
    @Inject(ReputationService)
    private readonly reputationService: Pick<ReputationService, 'applyPenalty'> = {
      applyPenalty: async () => undefined,
    },
    @Inject(LoyaltyService)
    private readonly loyaltyService: Pick<LoyaltyService, 'registerPendingReservation'> = {
      registerPendingReservation: async (_conductorId: string, _reservationId: string, _vehicleName: string, _vehicleId: string, _startAt: Date, _endAt: Date) => undefined,
    },
    @Inject(PRICE_QUOTE_REPOSITORY)
    private readonly priceQuoteRepository: PriceQuoteRepository = {
      save: async () => { throw new Error('PriceQuoteRepository not provided'); },
      findById: async () => null,
      countByHexSince: async () => 0,
      aggregateMultiplierByH3Since: async () => [],
      deleteExpiredBefore: async () => 0,
    },
    @Inject(PricingService)
    private readonly pricingService: Pick<
      PricingService,
      'quote' | 'quoteForVehicle'
    > = {
      quote: async () => { throw new Error('PricingService not provided'); },
      quoteForVehicle: async (input) => {
        const response = computePricingQuote({
          vehicleId: input.vehicle.getId(),
          basePriceDailyCents: input.vehicle.getBasePriceCents(),
          discountTiers: input.vehicle.getDiscountTiers(),
          startAt: input.startAt,
          endAt: input.endAt,
        });
        return { quote: null as unknown as never, response };
      },
    },
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
    await this.identityService.assertVerified(conductorId);
    await this.driverLicenseService.assertVerified(conductorId);

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

    const withHomeDelivery = dto.withHomeDelivery ?? false;
    const withHomeReturn = dto.withHomeReturn ?? false;

    if (withHomeDelivery && !vehicle.getHomeDeliveryEnabled()) {
      throw new VehicleHomeDeliveryNotEnabledException(vehicle.getId());
    }
    if (withHomeDelivery && !dto.deliveryAddress) {
      throw new HomeDeliveryAddressRequiredException();
    }
    if (withHomeReturn && !vehicle.getHomeReturnEnabled()) {
      throw new VehicleHomeReturnNotEnabledException(vehicle.getId());
    }
    if (withHomeReturn && !dto.returnAddress) {
      throw new HomeReturnAddressRequiredException();
    }

    const homeDeliveryFeeCentsSnapshot = withHomeDelivery
      ? (vehicle.getHomeDeliveryFeeCents() ?? null)
      : null;
    const homeReturnFeeCentsSnapshot = withHomeReturn
      ? (vehicle.getHomeReturnFeeCents() ?? null)
      : null;

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

    const pricingResult = await this.resolvePricingForCreate({
      vehicle,
      startAt,
      endAt,
      withHomeDelivery,
      withHomeReturn,
      conductorId,
      quoteToken: dto.quoteToken ?? null,
    });
    const pricingSnapshot = pricingResult.pricingSnapshot;
    const totalCents = pricingSnapshot.totalCents;

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
      basePriceCentsSnapshot: pricingSnapshot.basePriceCents,
      pricingSnapshot,
      withHomeDelivery,
      homeDeliveryFeeCentsSnapshot,
      deliveryAddress: dto.deliveryAddress ?? null,
      withHomeReturn,
      homeReturnFeeCentsSnapshot,
      returnAddress: dto.returnAddress ?? null,
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
      pricingSnapshot: saved.getPricingSnapshot() ?? pricingSnapshot,
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

    if (
      dto.paymentMethod === 'digital_wallet' &&
      !dto.walletProvider
    ) {
      throw new Error('walletProvider is required for digital_wallet');
    }

    const parsedWalletProvider = dto.walletProvider
      ? WalletProviderEnum.parse(dto.walletProvider)
      : undefined;

    if (!reservation.isPendingPayment() && !reservation.isPendingApproval()) {
      throw new InvalidReservationTransitionException(
        reservation.getStatus(),
        RESERVATION_STATUS.confirmed,
      );
    }

    await this.snapshotReservationRules(reservation);

    // US-26: el conductor elige pagar solo la seña. La reserva queda 'señada'
    // (pending_balance) con fecha límite para completar el saldo.
    if (dto.paymentMode === 'deposit') {
      if (reservation.getDepositPercentageSnapshot() === null) {
        throw new DepositNotAvailableException(reservationId);
      }
      const depositCents = computeDepositCents(
        reservation.getTotalCents(),
        reservation.getDepositPercentageSnapshot(),
      );
      reservation.payDeposit(
        dto.paymentMethod,
        depositCents,
        now,
        parsedWalletProvider,
      );
      const savedDeposit = await this.reservationRepository.update(reservation);

      await this.notificationProvider.notify(
        savedDeposit.getConductorId(),
        'Seña confirmada',
        `Señaste la reserva ${savedDeposit.getId().slice(0, 8)}. Tenés hasta el ${savedDeposit.getBalanceDueAt()!.toISOString()} para pagar el saldo.`,
      );
      await this.notificationProvider.notify(
        savedDeposit.getRentadorId(),
        'Reserva señada',
        `Un conductor señó una reserva para tu vehículo.`,
      );

      return ConfirmReservationPaymentResponseSchema.parse({
        id: savedDeposit.getId(),
        status: RESERVATION_STATUS.pending_balance,
        paidAt: savedDeposit.getDepositPaidAt()!.toISOString(),
        voucherToken: null,
        paidCents: savedDeposit.getDepositPaidCents()!,
        balanceCents: savedDeposit.getBalanceCents(),
        balanceDueAt: savedDeposit.getBalanceDueAt()!.toISOString(),
      });
    }

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
      { url: `/reservas/${saved.getId()}` },
    );
    await this.notificationProvider.notify(
      saved.getRentadorId(),
      'Nueva reserva confirmada',
      `Tenés una nueva reserva confirmada para el vehículo.`,
      { url: `/reservas/${saved.getId()}` },
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
      paidCents: saved.getTotalCents(),
      balanceCents: 0,
      balanceDueAt: null,
    });
  }

  public async initiateBankTransfer(
    conductorId: string,
    reservationId: string,
    dto: InitiateTransferRequest = { paymentMode: 'full' },
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

    // El snapshot debe estar resuelto antes de validar/cobrar la seña.
    await this.snapshotReservationRules(reservation);

    const mode = dto.paymentMode ?? 'full';
    if (mode === 'deposit' && reservation.getDepositPercentageSnapshot() === null) {
      throw new DepositNotAvailableException(reservationId);
    }
    const amountCents =
      mode === 'deposit'
        ? computeDepositCents(
            reservation.getTotalCents(),
            reservation.getDepositPercentageSnapshot(),
          )
        : reservation.getTotalCents();

    const { code: transferCode, alias: transferAlias } =
      await this.paymentGateway.generateTransferCode();
    reservation.initiateBankTransfer(now, transferCode, transferAlias, mode);
    const saved = await this.reservationRepository.update(reservation);

    this.autoConfirmTransfer(reservationId);

    return InitiateTransferResponseSchema.parse({
      id: saved.getId(),
      status: RESERVATION_STATUS.pending_approval,
      transferCode: saved.getTransferCode()!,
      transferAlias: saved.getTransferAlias()!,
      transferExpiresAt: saved.getTransferExpiresAt()!.toISOString(),
      totalCents: saved.getTotalCents(),
      amountCents,
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
          const nowTs = this.clock.now();
          if (r.isTransferExpired(nowTs)) return;
          await this.snapshotReservationRules(r);
          if (r.getTransferPaymentMode() === 'deposit') {
            const depositCents = computeDepositCents(
              r.getTotalCents(),
              r.getDepositPercentageSnapshot(),
            );
            r.confirmTransferAsDeposit(depositCents, nowTs);
          } else {
            r.confirmTransferPayment(nowTs);
          }
          await this.reservationRepository.update(r);
        } catch (e) {
          this.logger.warn(
            `autoConfirmTransfer failed for reservation ${reservationId}: ${e instanceof Error ? e.message : String(e)}`,
          );
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
    await this.snapshotReservationRules(reservation);

    // US-26: transferencia que cubre solo la seña → reserva señada.
    if (reservation.getTransferPaymentMode() === 'deposit') {
      const depositCents = computeDepositCents(
        reservation.getTotalCents(),
        reservation.getDepositPercentageSnapshot(),
      );
      reservation.confirmTransferAsDeposit(depositCents, now);
      const savedDeposit = await this.reservationRepository.update(reservation);

      await this.notificationProvider.notify(
        savedDeposit.getConductorId(),
        'Seña acreditada',
        `Tu seña fue acreditada. Tenés hasta el ${savedDeposit.getBalanceDueAt()!.toISOString()} para pagar el saldo.`,
      );
      await this.notificationProvider.notify(
        savedDeposit.getRentadorId(),
        'Reserva señada',
        `Un conductor señó una reserva para tu vehículo.`,
      );

      return ConfirmTransferResponseSchema.parse({
        id: savedDeposit.getId(),
        status: RESERVATION_STATUS.pending_balance,
        paidAt: savedDeposit.getDepositPaidAt()!.toISOString(),
        notified: true,
      });
    }

    reservation.confirmTransferPayment(now);
    const saved = await this.reservationRepository.update(reservation);

    const voucher = await this.voucherProvider.generateVoucher(saved.getId());

    await this.notificationProvider.notify(
      saved.getConductorId(),
      'Transferencia acreditada',
      `Tu transferencia fue acreditada. Reserva ${saved.getId().slice(0, 8)} confirmada.`,
      { url: `/reservas/${saved.getId()}` },
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
   * US-30: el conductor paga el saldo restante de una reserva señada por medio
   * inmediato (tarjeta/billetera). La reserva pasa a `confirmed` y se genera el
   * voucher.
   */
  public async payBalance(
    conductorId: string,
    reservationId: string,
    dto: ConfirmReservationBalanceRequest,
  ): Promise<ConfirmReservationBalanceResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }
    if (!reservation.isPendingBalance()) {
      throw new BalanceNotDueException(reservationId);
    }

    const now = this.clock.now();
    const parsedWalletProvider = dto.walletProvider
      ? WalletProviderEnum.parse(dto.walletProvider)
      : undefined;

    const balanceCents = reservation.getBalanceCents();
    await this.paymentGateway.processPayment(
      balanceCents,
      reservation.getCurrency(),
      dto.paymentMethod,
    );
    reservation.payBalance(dto.paymentMethod, now, parsedWalletProvider);
    const saved = await this.reservationRepository.update(reservation);

    await this.voucherProvider.generateVoucher(saved.getId());

    await this.notificationProvider.notify(
      saved.getConductorId(),
      'Reserva pagada',
      `Completaste el pago de la reserva ${saved.getId().slice(0, 8)}. Ya está confirmada.`,
    );
    await this.notificationProvider.notify(
      saved.getRentadorId(),
      'Saldo acreditado',
      `El conductor completó el pago de una reserva de tu vehículo.`,
    );
    const conductorProfile = await this.userRepository.getProfileById(conductorId);
    if (conductorProfile?.email) {
      const voucherData = await this.getVoucher(saved.getId(), conductorId);
      await this.emailProvider.sendVoucherEmail(conductorProfile.email, voucherData);
    }

    return ConfirmReservationBalanceResponseSchema.parse({
      id: saved.getId(),
      status: RESERVATION_STATUS.confirmed,
      paidAt: saved.getPaidAt()!.toISOString(),
      voucherToken: saved.getVoucherToken()!,
      balancePaidCents: balanceCents,
    });
  }

  /**
   * US-30: inicia el pago del saldo por transferencia bancaria. La reserva sigue
   * `pending_balance`; la acreditación (auto a los 5s en demo, o manual) la cierra.
   */
  public async initiateBalanceTransfer(
    conductorId: string,
    reservationId: string,
  ): Promise<InitiateBalanceTransferResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }
    if (!reservation.isPendingBalance()) {
      throw new BalanceNotDueException(reservationId);
    }

    const now = this.clock.now();
    const amountCents = reservation.getBalanceCents();
    const { code: transferCode, alias: transferAlias } =
      await this.paymentGateway.generateTransferCode();
    reservation.initiateBalanceTransfer(now, transferCode, transferAlias);
    const saved = await this.reservationRepository.update(reservation);

    this.autoConfirmBalanceTransfer(reservationId);

    return InitiateBalanceTransferResponseSchema.parse({
      id: saved.getId(),
      status: RESERVATION_STATUS.pending_balance,
      transferCode: saved.getTransferCode()!,
      transferAlias: saved.getTransferAlias()!,
      transferExpiresAt: saved.getTransferExpiresAt()!.toISOString(),
      amountCents,
      currency: 'ARS',
    });
  }

  /** Auto-acredita la transferencia del saldo después de 5 segundos (demo). */
  private autoConfirmBalanceTransfer(reservationId: string): void {
    setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const r = await this.reservationRepository.findById(reservationId);
          if (!r) return;
          if (!r.isPendingBalance()) return;
          const nowTs = this.clock.now();
          if (r.getTransferPaymentMode() !== 'balance') return;
          r.confirmBalanceTransfer(nowTs);
          await this.reservationRepository.update(r);
        } catch (e) {
          this.logger.warn(
            `autoConfirmBalanceTransfer failed for reservation ${reservationId}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      })();
    }, 5000);
  }

  /** US-30: acredita el saldo pagado por transferencia → reserva confirmada. */
  public async confirmBalanceTransfer(
    conductorId: string,
    reservationId: string,
  ): Promise<ConfirmBalanceTransferResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }

    const now = this.clock.now();
    reservation.confirmBalanceTransfer(now);
    const saved = await this.reservationRepository.update(reservation);

    const voucher = await this.voucherProvider.generateVoucher(saved.getId());

    await this.notificationProvider.notify(
      saved.getConductorId(),
      'Reserva pagada',
      `Tu transferencia fue acreditada. Reserva ${saved.getId().slice(0, 8)} confirmada.`,
    );
    await this.notificationProvider.notify(
      saved.getRentadorId(),
      'Saldo acreditado',
      `El conductor completó el pago de una reserva de tu vehículo.`,
    );

    return ConfirmBalanceTransferResponseSchema.parse({
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

    const parentId = reservation.getParentReservationId();
    if (parentId !== null) {
      const parent = await this.reservationRepository.findById(parentId);
      if (parent) {
        await this.attemptAutoChargeExtension(reservation, parent);
      }
    }

    return ApproveReservationResponseSchema.parse({
      id: reservation.getId(),
      status: reservation.getStatus(),
      holdExpiresAt: reservation.getHoldExpiresAt()?.toISOString() ?? null,
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

    await this.notificationProvider.notify(
      saved.getConductorId(),
      'Solicitud rechazada',
      `Tu solicitud de reserva fue rechazada por el rentador.${saved.getRejectionReason() ? ` Motivo: ${saved.getRejectionReason()}` : ''}`,
      { url: `/reservas/${saved.getId()}` },
    );

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
    const callerProfile = await this.userRepository.getProfileById(conductorId);
    const isAdmin = callerProfile?.isAdmin ?? false;
    if (
      !isAdmin &&
      !reservation.isOwnedByConductor(conductorId) &&
      reservation.getRentadorId() !== conductorId
    ) {
      throw new ReservationForbiddenException();
    }
    const chain = await this.reservationRepository.findChain(reservationId);
    return this.toDTO(reservation, chain);
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
      pricingSnapshot: this.resolvePricingSnapshot(reservation),
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
      pricingSnapshot: this.resolvePricingSnapshot(reservation),
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
   * US-26: cancela automáticamente las reservas señadas cuyo saldo no se pagó
   * antes de la fecha límite. Aplica la política de cancelación sobre la seña
   * pagada (no sobre el total) y acredita el reembolso al balance del conductor.
   * El vehículo vuelve a estar disponible al salir del estado bloqueante.
   */
  public async expireOverdueBalances(): Promise<number> {
    const now = this.clock.now();
    const overdue = await this.reservationRepository.findOverdueBalances(now);
    let processed = 0;
    for (const r of overdue) {
      try {
        const depositPaid = r.getDepositPaidCents() ?? 0;
        const refund = calculateCancellationRefund({
          startAt: r.getStartAt(),
          paidAt: r.getDepositPaidAt(),
          totalCents: depositPaid,
          cancellationPolicy: r.getCancellationPolicySnapshot(),
          now,
        });
        r.expireOverdueBalance(now);
        await this.reservationRepository.update(r);
        if (refund.refundCents > 0) {
          await this.userRepository.creditBalance(
            r.getConductorId(),
            refund.refundCents,
          );
        }
        await this.notificationProvider.notify(
          r.getConductorId(),
          'Reserva cancelada por falta de pago',
          `Tu reserva ${r.getId().slice(0, 8)} se canceló porque no se pagó el saldo a tiempo. Reembolso de la seña: ${refund.refundCents} centavos.`,
        );
        await this.notificationProvider.notify(
          r.getRentadorId(),
          'Reserva señada cancelada',
          `Una reserva señada de tu vehículo se canceló por falta de pago del saldo. El vehículo vuelve a estar disponible.`,
        );
        processed += 1;
      } catch (e) {
        // Race condition: el conductor pudo pagar el saldo justo antes del job.
        this.logger.warn(
          `expireOverdueBalances skipped reservation ${r.getId()}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return processed;
  }

  /**
   * US-30: envía un recordatorio al conductor cuando faltan ~24h para la fecha
   * límite de pago del saldo. Idempotente vía `balanceReminderSentAt`.
   */
  public async sendUpcomingBalanceReminders(): Promise<number> {
    const now = this.clock.now();
    const candidates =
      await this.reservationRepository.findBalanceReminderCandidates(now);
    for (const r of candidates) {
      await this.notificationProvider.notify(
        r.getConductorId(),
        'Recordatorio: pago de saldo pendiente',
        `Tu reserva ${r.getId().slice(0, 8)} vence el ${r.getBalanceDueAt()!.toISOString()}. Completá el pago para no perderla.`,
      );
      r.markBalanceReminderSent(now);
      await this.reservationRepository.update(r);
    }
    return candidates.length;
  }

  /**
   * Cancela una reserva pendiente del conductor. Acepta tanto `pending_payment`
   * (hold de pago activo) como `pending_approval` (solicitud sin respuesta del
   * rentador — el conductor la retira) y `confirmed`/`in_progress` (cancelación
   * con política de reembolso).
   *
   * Si la reserva pertenece a una cadena (padre + extensiones), cancela todos
   * los eslabones cancelables del chain en una sola transacción atómica. La
   * política de cancelación se aplica por eslabón (cada uno tiene su propio
   * snapshot) y el reembolso se acumula en el balance del conductor.
   *
   * @param conductorId - ID del conductor autenticado (extraído del JWT). Se valida
   *   que sea el dueño de la reserva: si no, 403.
   * @param reservationId - ID de cualquier eslabón del chain a cancelar.
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
    if (reservation.getParentReservationId()) {
      throw new CancelExtensionNotAllowedException();
    }

    const now = this.clock.now();
    const chain = await this.reservationRepository.findChain(reservationId);
    const cancelables =
      chain.length > 0 ? collectDescendants(reservationId, chain) : [reservation];
    const toCancel = cancelables.filter(isCancelable);

    if (toCancel.length === 0) {
      reservation.cancel(now);
      const saved = await this.reservationRepository.update(reservation);
      const profile = await this.userRepository.getProfileById(conductorId);
      return CancelReservationResponseSchema.parse({
        id: saved.getId(),
        status: RESERVATION_STATUS.cancelled,
        cancelledBy: 'conductor',
        refundCents: 0,
        reputationPenalty: 0,
        balanceInCents: profile?.balanceInCents ?? 0,
        currency: 'ARS',
      });
    }

    let totalRefundCents = 0;
    for (const r of toCancel) {
      // Reservas señadas: el conductor solo abonó la seña, así que el reembolso
      // se calcula sobre `depositPaidCents` y la fecha del pago de la seña.
      const refundBaseCents = r.isPendingBalance()
        ? (r.getDepositPaidCents() ?? 0)
        : r.getTotalCents();
      const refundPaidAt = r.isPendingBalance()
        ? r.getDepositPaidAt()
        : r.getPaidAt();
      const refund = calculateCancellationRefund({
        startAt: r.getStartAt(),
        paidAt: refundPaidAt,
        totalCents: refundBaseCents,
        cancellationPolicy: r.getCancellationPolicySnapshot(),
        now,
      });
      totalRefundCents += refund.refundCents;
      r.cancel(now);
    }
    const { balanceInCents } = await this.reservationRepository.cancelManyAndCreditBalance(
      toCancel,
      conductorId,
      totalRefundCents,
    );

    return CancelReservationResponseSchema.parse({
      id: reservationId,
      status: RESERVATION_STATUS.cancelled,
      cancelledBy: 'conductor',
      refundCents: totalRefundCents,
      reputationPenalty: 0,
      balanceInCents,
      currency: 'ARS',
    });
  }

  public async cancelReservationByRentador(
    rentadorId: string,
    reservationId: string,
  ): Promise<CancelReservationResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByRentador(rentadorId)) {
      throw new ReservationForbiddenException();
    }
    if (reservation.getParentReservationId()) {
      throw new CancelExtensionNotAllowedException();
    }

    const now = this.clock.now();
    const chain = await this.reservationRepository.findChain(reservationId);
    const cancelables =
      chain.length > 0 ? collectDescendants(reservationId, chain) : [reservation];
    const toCancel = cancelables.filter(isCancelable);

    if (toCancel.length === 0) {
      reservation.cancelByRentador(now);
      const saved = await this.reservationRepository.update(reservation);
      const profile = await this.userRepository.getProfileById(reservation.getConductorId());
      return {
        id: saved.getId(),
        status: RESERVATION_STATUS.cancelled,
        cancelledBy: 'owner',
        refundCents: 0,
        reputationPenalty: 0,
        balanceInCents: profile?.balanceInCents ?? 0,
        currency: 'ARS',
      };
    }

    let totalRefundCents = 0;
    for (const r of toCancel) {
      totalRefundCents += r.getTotalCents();
      r.cancelByRentador(now);
    }
    const { balanceInCents } = await this.reservationRepository.cancelManyAndCreditBalance(
      toCancel,
      reservation.getConductorId(),
      totalRefundCents,
    );

    const REPUTATION_PENALTY = 5.0; // The deduction value to pass to applyPenalty
    await this.reputationService.applyPenalty({
      userId: rentadorId,
      role: 'rentador',
      reason: 'Cancelación de reserva confirmada',
      scoreDeduction: REPUTATION_PENALTY,
      ticketId: reservationId, // Use the reservation ID as the ticket for uniqueness
    });

    await this.notificationProvider.notify(
      reservation.getConductorId(),
      'Reserva cancelada por el rentador',
      `El rentador ha cancelado tu reserva. Recibiste un reembolso de $${totalRefundCents / 100} ARS.`,
      { url: `/reservas/${reservation.getId()}` },
    );
    const conductorProfile = await this.userRepository.getProfileById(reservation.getConductorId());
    if (conductorProfile?.email) {
      await this.emailProvider.sendCancellationEmail(
        conductorProfile.email,
        'Reserva cancelada por el rentador',
        `El rentador ha cancelado tu reserva ${reservationId}. Recibiste un reembolso de $${totalRefundCents / 100} ARS.`,
      );
    }

    await this.notificationProvider.notify(
      rentadorId,
      'Reserva cancelada',
      `Has cancelado la reserva ${reservationId}. Se aplicó una penalización a tu reputación.`,
      { url: `/reservas/${reservationId}` },
    );
    const rentadorProfile = await this.userRepository.getProfileById(rentadorId);
    if (rentadorProfile?.email) {
      await this.emailProvider.sendCancellationEmail(
        rentadorProfile.email,
        'Reserva cancelada',
        `Has cancelado la reserva ${reservationId}. Se aplicó una penalización a tu reputación.`,
      );
    }

    return {
      id: reservationId,
      status: RESERVATION_STATUS.cancelled,
      cancelledBy: 'owner',
      refundCents: totalRefundCents,
      reputationPenalty: -REPUTATION_PENALTY,
      balanceInCents,
      currency: 'ARS',
    };
  }

  /**
   * Un eslabón es una extensión pendiente si tiene padre (no es el root del
   * chain) y todavía espera aprobación del rentador (`pending_approval`) o
   * pago del conductor (`pending_payment`).
   */
  private isPendingExtension(reservation: Reservation): boolean {
    return (
      reservation.getParentReservationId() !== null &&
      (reservation.isPendingApproval() || reservation.isPendingPayment())
    );
  }

  /**
   * Solicita una extensión del alquiler. La extensión es un nuevo eslabón en
   * la cadena de reservas: una row con `parentReservationId` apuntando al
   * último eslabón activo del chain, `startAt = endAt` de ese padre y
   * `endAt = newEndAt`. Reusa toda la state machine (auto-accept, hold,
   * EXCLUDE constraint, cobro stub) sin entity nueva.
   *
   * Modo solicitud (`pending_approval` con hold 24h) si:
   *  - el vehículo tiene `autoAccept = false`, o
   *  - el total acumulado del chain + esta extensión excede `maxRentalDays`
   *    del set actual del vehículo (override).
   * En cualquier otro caso entra como `pending_payment` con hold de 10min y
   * se intenta cobrar al `paymentMethod` snapshot del padre (stub). Si falla,
   * la reserva permanece en `pending_payment` para que el conductor complete
   * el pago manualmente.
   *
   * El snapshot de reglas y el precio de la extensión se toman de las reglas
   * VIGENTES del vehículo al momento de extender, no del snapshot del padre.
   * Es intencional: si el rentador subió el precio o ajustó las reglas, la
   * extensión refleja las condiciones actuales (el padre mantiene las suyas).
   *
   * @param conductorId - ID del conductor autenticado.
   * @param parentReservationId - ID de la reserva `in_progress` desde la que
   *   se solicita la extensión. Si tiene extensiones previas, el nuevo eslabón
   *   se cuelga de la punta activa, no de este id.
   * @param dto - Payload con `newEndAt`.
   */
  public async extendReservation(
    conductorId: string,
    parentReservationId: string,
    dto: ExtendReservationRequest,
  ): Promise<ExtendReservationResponse> {
    const parentRequest =
      await this.reservationRepository.findById(parentReservationId);
    if (!parentRequest) throw new ReservationNotFoundException(parentReservationId);
    if (!parentRequest.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }
    if (!parentRequest.isInProgress()) {
      throw new ExtensionParentNotInProgressException(parentReservationId);
    }

    const chain = await this.reservationRepository.findChain(parentReservationId);
    if (chain.some((r) => this.isPendingExtension(r))) {
      throw new PendingExtensionExistsException(parentReservationId);
    }

    const tip =
      (await this.reservationRepository.findChainTipFor(parentReservationId)) ??
      parentRequest;

    const newEndAt = new Date(dto.newEndAt);
    if (newEndAt.getTime() <= tip.getEndAt().getTime()) {
      throw new ExtensionInvalidEndAtException(
        'newEndAt must be strictly after the current chain endAt',
      );
    }

    const vehicle = await this.vehicleRepository.findById(parentRequest.getVehicleId());
    if (!vehicle) {
      throw new EntityNotFoundException('vehicle', parentRequest.getVehicleId());
    }
    if (!vehicle.isEnabled()) {
      throw new VehicleNotAvailableException(vehicle.getId());
    }

    const ruleSet = await this.resolveRuleSetForVehicle(
      vehicle.getId(),
      vehicle.getReservationRuleSetId(),
    );
    const rules = {
      depositPercentage:
        ruleSet?.getDepositPercentage() ?? RESERVATION_RULES_DEFAULTS.depositPercentage,
      basePriceCents: vehicle.getBasePriceCents(),
      cancellationPolicy:
        ruleSet?.getCancellationPolicy() ?? RESERVATION_RULES_DEFAULTS.cancellationPolicy,
      maxKilometrage:
        ruleSet?.getMaxKilometrage() ?? RESERVATION_RULES_DEFAULTS.maxKilometrage,
      rentalTimeConstraints:
        ruleSet?.getRentalTimeConstraints() ?? RESERVATION_RULES_DEFAULTS.rentalTimeConstraints,
    };

    const maxRentalDays = rules.rentalTimeConstraints.maxDays;
    const chainTotalDays = computeChainTotalDays(chain, tip);
    const extensionDays = countDays(tip.getEndAt(), newEndAt);
    const exceedsMax =
      typeof maxRentalDays === 'number' && chainTotalDays + extensionDays > maxRentalDays;

    const ownerProfile = await this.userRepository.getProfileById(
      vehicle.getOwnerId(),
    );
    const vehicleAutoAccept =
      vehicle.getAutoAccept() ?? ownerProfile?.autoAccept ?? false;
    const effectiveAutoAccept = vehicleAutoAccept && !exceedsMax;
    const requiresApproval = !effectiveAutoAccept;

    const now = this.clock.now();
    const extensionQuote = await this.pricingService.quoteForVehicle({
      vehicle,
      startAt: tip.getEndAt(),
      endAt: newEndAt,
      withHomeDelivery: false,
      withHomeReturn: false,
      conductorId,
    });
    const pricingSnapshot = extensionQuote.response;
    const totalCents = pricingSnapshot.totalCents;
    const status = requiresApproval
      ? RESERVATION_STATUS.pending_approval
      : RESERVATION_STATUS.pending_payment;
    const ttlMs = requiresApproval ? APPROVAL_TTL_MS : HOLD_TTL_MS;

    const overlapping = await this.reservationRepository.findOverlapping(
      vehicle.getId(),
      tip.getEndAt(),
      newEndAt,
      BLOCKING_STATUSES,
    );
    const conflicting = overlapping.find((r) => r.getId() !== tip.getId());
    if (conflicting) {
      throw new VehicleNotAvailableException(vehicle.getId());
    }

    const extension = Reservation.fromExtensionRequest({
      parent: tip,
      newEndAt,
      totalCents,
      status,
      holdExpiresAt: new Date(now.getTime() + ttlMs),
      snapshot: {
        ...rules,
        pricingSnapshot,
      },
      now,
    });

    let saved: Reservation;
    try {
      saved = await this.reservationRepository.save(extension);
    } catch (e) {
      if (isExclusionViolation(e)) {
        throw new VehicleNotAvailableException(vehicle.getId());
      }
      throw e;
    }

    const holdExpiresAtIso = saved.getHoldExpiresAt()!.toISOString();
    const initialStatus = saved.getStatus();
    if (!requiresApproval) {
      await this.attemptAutoChargeExtension(saved, parentRequest);
    }

    const audienceId = requiresApproval ? saved.getRentadorId() : saved.getConductorId();
    const subject = requiresApproval
      ? 'Solicitud de extensión recibida'
      : 'Extensión confirmada';
    const message = requiresApproval
      ? 'Tenés una solicitud de extensión pendiente de aprobación.'
      : 'Tu alquiler fue extendido. Completá el pago para confirmar.';
    await this.notificationProvider.notify(audienceId, subject, message, { url: `/reservas/${saved.getId()}` });

    const otherPartyId = requiresApproval ? saved.getConductorId() : saved.getRentadorId();
    const otherSubject = requiresApproval ? 'Solicitud de extensión enviada' : 'Extensión aprobada';
    const otherMessage = requiresApproval
      ? 'Tu solicitud de extensión fue enviada al rentador.'
      : 'Se aprobó una extensión para tu vehículo.';
    await this.notificationProvider.notify(otherPartyId, otherSubject, otherMessage, { url: `/reservas/${saved.getId()}` });

    return ExtendReservationResponseSchema.parse({
      id: saved.getId(),
      parentReservationId: tip.getId(),
      status: initialStatus,
      holdExpiresAt: holdExpiresAtIso,
      totalCents: saved.getTotalCents(),
      currency: 'ARS',
      requiresApproval,
      pricingSnapshot: saved.getPricingSnapshot() ?? pricingSnapshot,
    });
  }

  /**
   * Modifica una extensión todavía pendiente (de aprobación o de pago),
   * cambiando su fecha de devolución. Recalcula total, `requiresApproval` y
   * estado con las mismas reglas que `extendReservation`, pero sobre el
   * eslabón existente en vez de crear uno nuevo.
   *
   * @param conductorId - ID del conductor autenticado (dueño de la extensión).
   * @param extensionId - ID del eslabón de extensión pendiente a modificar.
   * @param dto - Payload con el nuevo `newEndAt`.
   */
  public async modifyExtension(
    conductorId: string,
    extensionId: string,
    dto: ExtendReservationRequest,
  ): Promise<ExtendReservationResponse> {
    const extension = await this.reservationRepository.findById(extensionId);
    if (!extension) throw new ReservationNotFoundException(extensionId);
    if (!extension.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }
    if (!this.isPendingExtension(extension)) {
      throw new ExtensionNotPendingException(extensionId);
    }

    const parentId = extension.getParentReservationId()!;
    const parent = await this.reservationRepository.findById(parentId);
    if (!parent) throw new ReservationNotFoundException(parentId);

    const newEndAt = new Date(dto.newEndAt);
    if (newEndAt.getTime() <= parent.getEndAt().getTime()) {
      throw new ExtensionInvalidEndAtException(
        'newEndAt must be strictly after the previous chain endAt',
      );
    }

    const vehicle = await this.vehicleRepository.findById(
      extension.getVehicleId(),
    );
    if (!vehicle) {
      throw new EntityNotFoundException('vehicle', extension.getVehicleId());
    }
    if (!vehicle.isEnabled()) {
      throw new VehicleNotAvailableException(vehicle.getId());
    }

    const ruleSet = await this.resolveRuleSetForVehicle(
      vehicle.getId(),
      vehicle.getReservationRuleSetId(),
    );
    const rules = {
      depositPercentage:
        ruleSet?.getDepositPercentage() ?? RESERVATION_RULES_DEFAULTS.depositPercentage,
      basePriceCents: vehicle.getBasePriceCents(),
      cancellationPolicy:
        ruleSet?.getCancellationPolicy() ?? RESERVATION_RULES_DEFAULTS.cancellationPolicy,
      maxKilometrage:
        ruleSet?.getMaxKilometrage() ?? RESERVATION_RULES_DEFAULTS.maxKilometrage,
      rentalTimeConstraints:
        ruleSet?.getRentalTimeConstraints() ?? RESERVATION_RULES_DEFAULTS.rentalTimeConstraints,
    };

    const maxRentalDays = rules.rentalTimeConstraints.maxDays;
    const chain = await this.reservationRepository.findChain(parentId);
    const chainWithoutThis = chain.filter(
      (r) => r.getId() !== extension.getId(),
    );
    const chainTotalDays = computeChainTotalDays(chainWithoutThis, parent);
    const extensionDays = countDays(parent.getEndAt(), newEndAt);
    const exceedsMax =
      typeof maxRentalDays === 'number' && chainTotalDays + extensionDays > maxRentalDays;

    const ownerProfile = await this.userRepository.getProfileById(
      vehicle.getOwnerId(),
    );
    const vehicleAutoAccept =
      vehicle.getAutoAccept() ?? ownerProfile?.autoAccept ?? false;
    const effectiveAutoAccept = vehicleAutoAccept && !exceedsMax;
    const requiresApproval = !effectiveAutoAccept;

    const now = this.clock.now();
    const modifyQuote = await this.pricingService.quoteForVehicle({
      vehicle,
      startAt: parent.getEndAt(),
      endAt: newEndAt,
      withHomeDelivery: false,
      withHomeReturn: false,
      conductorId,
    });
    const pricingSnapshot = modifyQuote.response;
    const totalCents = pricingSnapshot.totalCents;
    const status = requiresApproval
      ? RESERVATION_STATUS.pending_approval
      : RESERVATION_STATUS.pending_payment;
    const ttlMs = requiresApproval ? APPROVAL_TTL_MS : HOLD_TTL_MS;

    const overlapping = await this.reservationRepository.findOverlapping(
      vehicle.getId(),
      parent.getEndAt(),
      newEndAt,
      BLOCKING_STATUSES,
    );
    const conflicting = overlapping.find(
      (r) => r.getId() !== extension.getId() && r.getId() !== parent.getId(),
    );
    if (conflicting) {
      throw new VehicleNotAvailableException(vehicle.getId());
    }

    extension.modifyExtension({
      newEndAt,
      totalCents,
      status,
      holdExpiresAt: new Date(now.getTime() + ttlMs),
      snapshot: {
        ...rules,
        pricingSnapshot,
      },
      now,
    });

    let saved: Reservation;
    try {
      saved = await this.reservationRepository.update(extension);
    } catch (e) {
      if (isExclusionViolation(e)) {
        throw new VehicleNotAvailableException(vehicle.getId());
      }
      throw e;
    }

    const holdExpiresAtIso = saved.getHoldExpiresAt()!.toISOString();
    const initialStatus = saved.getStatus();
    if (!requiresApproval) {
      await this.attemptAutoChargeExtension(saved, parent);
    }

    return ExtendReservationResponseSchema.parse({
      id: saved.getId(),
      parentReservationId: parentId,
      status: initialStatus,
      holdExpiresAt: holdExpiresAtIso,
      totalCents: saved.getTotalCents(),
      currency: 'ARS',
      requiresApproval,
      pricingSnapshot: saved.getPricingSnapshot() ?? pricingSnapshot,
    });
  }

  /**
   * Intenta cobrar la extensión de forma inmediata usando el `paymentMethod`
   * snapshot del padre. Si el gateway responde éxito, transiciona la reserva
   * a `confirmed` y genera voucher. Si falla, deja la reserva en
   * `pending_payment` con el hold abierto para que el conductor complete el
   * pago manualmente.
   */
  private async attemptAutoChargeExtension(
    extension: Reservation,
    parent: Reservation,
  ): Promise<void> {
    const paymentMethod = parent.getPaymentMethod();
    if (!paymentMethod) return;
    const walletProvider = parent.getWalletProvider();
    try {
      const result = await this.paymentGateway.processPayment(
        extension.getTotalCents(),
        extension.getCurrency(),
        paymentMethod,
      );
      if (!result.success) return;
      const now = this.clock.now();
      extension.confirmPayment(paymentMethod, now, walletProvider ?? undefined);
      await this.reservationRepository.update(extension);
      await this.voucherProvider.generateVoucher(extension.getId());
      this.logger.debug(`auto-charged extension ${extension.getId()}`);
    } catch (e) {
      this.logger.warn(
        `auto-charge extension failed ${extension.getId()}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
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

    await this.notificationProvider.notify(
      saved.getConductorId(),
      'Alquiler iniciado',
      `El rentador escaneó tu QR. Tu alquiler está en curso.`,
      { url: `/reservas/${saved.getId()}` },
    );

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
    const now = this.clock.now();
    reservation.confirmReturn(returnQrToken, now);
    await this.reservationRepository.update(reservation);
    await this.walletService.recordReservationPayout(reservation);
    const vehicle = await this.vehicleRepository.findById(reservation.getVehicleId());
    const vehicleName = vehicle ? `${vehicle.getBrand()} ${vehicle.getModel()}` : 'Vehículo';
    await this.loyaltyService.registerPendingReservation(
      reservation.getConductorId(),
      reservation.getId(),
      vehicleName,
      reservation.getVehicleId(),
      reservation.getStartAt(),
      reservation.getEndAt(),
    );

    // Cascade completion to every other chain member that has been confirmed or
    // is already in_progress (extensions that were paid for or actively running).
    const chain = await this.reservationRepository.findChain(reservation.getId());
    const cascadeTargets = chain.filter(
      r => r.getId() !== reservation.getId() && (r.isInProgress() || r.isConfirmed()),
    );
    if (cascadeTargets.length > 0) {
      for (const r of cascadeTargets) {
        r.completeFromChain(now);
      }
      await this.reservationRepository.updateMany(cascadeTargets);
      for (const r of cascadeTargets) {
        await this.walletService.recordReservationPayout(r);
      }
    }

    await this.notificationProvider.notify(
      reservation.getConductorId(),
      'Alquiler completado',
      `Devolviste el vehículo. Tu alquiler fue completado con éxito.`,
      { url: `/reservas/${reservation.getId()}` },
    );
    await this.notificationProvider.notify(
      reservation.getRentadorId(),
      'Devolución registrada',
      `El conductor devolvió el vehículo. La reserva fue completada.`,
      { url: `/reservas/${reservation.getId()}` },
    );

    return ConfirmReturnResponseSchema.parse({
      reservationId: reservation.getId(),
      status: RESERVATION_STATUS.completed,
      completedAt: reservation.getCompletedAt()!.toISOString(),
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

  /**
   * Materializa el snapshot de reglas + precio sobre una reserva en transición
   * a `confirmed`. Resuelve el set del vehículo (privado tiene prioridad sobre
   * compartido; en condiciones normales solo uno está poblado) y, si no hay
   * set, usa los defaults definidos en `RESERVATION_RULES_DEFAULTS`.
   *
   * El `basePriceCents` se toma del vehículo en el momento del snapshot, no
   * del `totalCents` de la reserva (que ya fue calculado al crear con días *
   * precio del momento).
   */
  /**
   * Determina el `pricingSnapshot` final de una nueva reserva. Si vino un
   * `quoteToken` válido y vigente, respeta los valores cotizados (multiplier
   * y descuento freezeados al momento del quote). Caso contrario, recotiza
   * al vuelo aplicando el motor de pricing dinámico.
   */
  private async resolvePricingForCreate(input: {
    vehicle: Vehicle;
    startAt: Date;
    endAt: Date;
    withHomeDelivery: boolean;
    withHomeReturn: boolean;
    conductorId: string;
    quoteToken: string | null;
  }): Promise<{ pricingSnapshot: PricingQuote }> {
    if (input.quoteToken) {
      const quote = await this.priceQuoteRepository.findById(input.quoteToken);
      if (!quote) {
        throw new PriceQuoteNotFoundException(input.quoteToken);
      }
      const now = this.clock.now();
      if (quote.isExpired(now)) {
        throw new PriceQuoteExpiredException(input.quoteToken);
      }
      if (!quote.matchesVehicle(input.vehicle.getId())) {
        throw new PriceQuoteVehicleMismatchException(
          input.quoteToken,
          input.vehicle.getId(),
        );
      }
      if (!quote.isUsableBy(input.conductorId)) {
        throw new PriceQuoteConductorMismatchException(input.quoteToken);
      }
      const datesMatch =
        quote.getStartAt().getTime() === input.startAt.getTime() &&
        quote.getEndAt().getTime() === input.endAt.getTime();
      if (datesMatch) {
        const durationDays = Math.max(
          1,
          Math.ceil(
            (input.endAt.getTime() - input.startAt.getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        );
        const baseOnly = computeBaseRentalCents(
          quote.getBasePriceCents(),
          input.startAt,
          input.endAt,
        );
        const subtotalWithMultiplier = Math.round(
          baseOnly * quote.getMultiplier(),
        );
        const pricingSnapshot: PricingQuote = {
          vehicleId: input.vehicle.getId(),
          currency: 'ARS',
          basePriceCents: quote.getBasePriceCents(),
          durationDays,
          subtotalCents: subtotalWithMultiplier,
          appliedDiscountTier:
            quote.getDiscountPercentage() > 0
              ? {
                  minimumDays: durationDays,
                  discountPercentage: quote.getDiscountPercentage(),
                }
              : null,
          appliedDiscountPercentage: quote.getDiscountPercentage(),
          discountCents: Math.floor(
            (subtotalWithMultiplier * quote.getDiscountPercentage()) / 100,
          ),
          totalCents: quote.getTotalCents(),
          multiplier: quote.getMultiplier(),
          deliveryFeeCents: quote.getDeliveryFeeCents(),
          quoteToken: quote.getId(),
          expiresAt: quote.getExpiresAt().toISOString(),
          levelDiscountPercentage: quote.getLevelDiscountPercentage(),
        };
        return { pricingSnapshot };
      }
    }

    const result = await this.pricingService.quoteForVehicle({
      vehicle: input.vehicle,
      startAt: input.startAt,
      endAt: input.endAt,
      withHomeDelivery: input.withHomeDelivery,
      withHomeReturn: input.withHomeReturn,
      conductorId: input.conductorId,
    });
    return { pricingSnapshot: result.response };
  }

  private async snapshotReservationRules(reservation: Reservation): Promise<void> {
    const vehicle = await this.vehicleRepository.findById(reservation.getVehicleId());
    if (!vehicle) {
      throw new EntityNotFoundException('vehicle', reservation.getVehicleId());
    }

    const ruleSet = await this.resolveRuleSetForVehicle(vehicle.getId(), vehicle.getReservationRuleSetId());

    reservation.applyRulesSnapshot({
      depositPercentage:
        ruleSet?.getDepositPercentage() ?? RESERVATION_RULES_DEFAULTS.depositPercentage,
      basePriceCents: vehicle.getBasePriceCents(),
      cancellationPolicy:
        ruleSet?.getCancellationPolicy() ?? RESERVATION_RULES_DEFAULTS.cancellationPolicy,
      maxKilometrage:
        ruleSet?.getMaxKilometrage() ?? RESERVATION_RULES_DEFAULTS.maxKilometrage,
      rentalTimeConstraints:
        ruleSet?.getRentalTimeConstraints() ?? RESERVATION_RULES_DEFAULTS.rentalTimeConstraints,
    });
  }

  private async resolveRuleSetForVehicle(
    vehicleId: string,
    sharedRuleSetId: string | null,
  ): Promise<ReservationRuleSet | null> {
    const privateRuleSet =
      await this.reservationRuleSetRepository.findPrivateByVehicleId(vehicleId);
    if (privateRuleSet) return privateRuleSet;
    if (!sharedRuleSetId) return null;
    return this.reservationRuleSetRepository.findById(sharedRuleSetId);
  }

  private async toDTO(
    r: Reservation,
    chain: Reservation[] = [],
  ): Promise<GetReservationResponse> {
    const [vehicle, rentadorProfile] = await Promise.all([
      this.vehicleRepository.findById(r.getVehicleId()),
      this.userRepository.getProfileById(r.getRentadorId()),
    ]);
    const reservationRuleSet = await this.getVehicleReservationRuleSet(vehicle);
    const chainPayload: ReservationChainItem[] | undefined =
      chain.length > 1
        ? chain.map((item) => ({
            id: item.getId(),
            status: item.getStatus(),
            startAt: item.getStartAt().toISOString(),
            endAt: item.getEndAt().toISOString(),
            totalCents: item.getTotalCents(),
            parentReservationId: item.getParentReservationId(),
            pricingSnapshot: this.resolvePricingSnapshot(item),
          }))
        : undefined;

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
      depositPaidCents: r.getDepositPaidCents(),
      depositPaidAt: r.getDepositPaidAt()
        ? r.getDepositPaidAt()!.toISOString()
        : null,
      balanceDueAt: r.getBalanceDueAt() ? r.getBalanceDueAt()!.toISOString() : null,
      balanceReminderSentAt: r.getBalanceReminderSentAt()
        ? r.getBalanceReminderSentAt()!.toISOString()
        : null,
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
      transferPaymentMode: r.getTransferPaymentMode(),
      depositPercentageSnapshot: r.getDepositPercentageSnapshot(),
      basePriceCentsSnapshot: r.getBasePriceCentsSnapshot(),
      pricingSnapshot: this.resolvePricingSnapshot(r),
      cancellationPolicySnapshot: r.getCancellationPolicySnapshot(),
      maxKilometrageSnapshot: r.getMaxKilometrageSnapshot(),
      rentalTimeConstraintsSnapshot: r.getRentalTimeConstraintsSnapshot(),
      withHomeDelivery: r.getWithHomeDelivery(),
      homeDeliveryFeeCentsSnapshot: r.getHomeDeliveryFeeCentsSnapshot(),
      deliveryAddress: r.getDeliveryAddress(),
      withHomeReturn: r.getWithHomeReturn(),
      homeReturnFeeCentsSnapshot: r.getHomeReturnFeeCentsSnapshot(),
      returnAddress: r.getReturnAddress(),
      parentReservationId: r.getParentReservationId(),
      chain: chainPayload,
      createdAt: r.getCreatedAt().toISOString(),
      updatedAt: r.getUpdatedAt().toISOString(),
      reviews: [],
      vehicle: this.vehicleSummary(vehicle, r.getVehicleId(), reservationRuleSet),
      rentador: {
        id: r.getRentadorId(),
        name: rentadorProfile?.name ?? 'Rentador',
        avatarUrl: rentadorProfile?.avatarUrl ?? null,
      },
    });
  }

  private resolvePricingSnapshot(reservation: Reservation) {
    const snapshot = reservation.getPricingSnapshot();
    if (!snapshot) {
      const durationDays = Math.max(
        1,
        Math.ceil(
          (reservation.getEndAt().getTime() - reservation.getStartAt().getTime()) /
            DAY_MS,
        ),
      );

      return {
        vehicleId: reservation.getVehicleId(),
        currency: 'ARS' as const,
        basePriceCents: reservation.getBasePriceCentsSnapshot(),
        durationDays,
        subtotalCents: reservation.getTotalCents(),
        appliedDiscountTier: null,
        appliedDiscountPercentage: 0,
        discountCents: 0,
        totalCents: reservation.getTotalCents(),
      };
    }

    // Fallback para snapshots existentes que se guardaron sin levelDiscountPercentage
    // (previo a agregar el campo a PriceQuoteEntity). Deduce el porcentaje restando
    // el descuento por tiers del descuento total. Asume que discountCents es solo
    // tier + level, sin otros descuentos mixtos.
    if (snapshot.levelDiscountPercentage == null) {
      const appliedDiscountAmount = Math.floor(
        snapshot.subtotalCents * ((snapshot.appliedDiscountPercentage ?? 0) / 100),
      );
      const levelDiscountAmount = snapshot.discountCents - appliedDiscountAmount;
      const levelDiscountPercentage =
        levelDiscountAmount > 0 && snapshot.subtotalCents > 0
          ? Math.round((levelDiscountAmount / snapshot.subtotalCents) * 100)
          : undefined;
      return { ...snapshot, levelDiscountPercentage };
    }

    return snapshot;
  }

  private async getVehicleReservationRuleSet(
    vehicle: Vehicle | null,
  ): Promise<ReservationRuleSetPublic | null> {
    if (!vehicle) return null;

    const ruleSet = await this.resolveRuleSetForVehicle(
      vehicle.getId(),
      vehicle.getReservationRuleSetId(),
    );
    if (!ruleSet) return null;

    return {
      id: ruleSet.getId(),
      rentalorId: ruleSet.getRentalorId(),
      cancellationPolicy: ruleSet.getCancellationPolicy(),
      depositPercentage: ruleSet.getDepositPercentage(),
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
      voucherToken: r.getVoucherToken() ?? null,
      depositPaidCents: r.getDepositPaidCents(),
      balanceDueAt: r.getBalanceDueAt() ? r.getBalanceDueAt()!.toISOString() : null,
      rejectionReason: r.getRejectionReason(),
      parentReservationId: r.getParentReservationId(),
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
        plate: '—',
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
      plate: vehicle.getPlate(),
      reservationRuleSet,
    };
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Días contables entre dos fechas redondeando hacia arriba: una extensión de
 * 23h cuenta como 1 día. Mantiene paridad con `computeReservationTotalCents`,
 * que ya redondea por día completo.
 */
function countDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / DAY_MS);
}

/**
 * Suma los días de los eslabones que siguen vivos en la cadena. Se excluyen
 * los cancelados, rechazados y expirados porque no consumen el cupo de
 * `maxRentalDays` del set. La nueva extensión todavía no está en `chain`, por
 * lo que el caller debe sumar sus días aparte.
 */
function computeChainTotalDays(chain: Reservation[], tip: Reservation): number {
  const alive = chain.filter((r) => {
    const status = r.getStatus();
    return (
      status !== RESERVATION_STATUS.cancelled &&
      status !== RESERVATION_STATUS.rejected &&
      status !== RESERVATION_STATUS.expired
    );
  });
  if (alive.length === 0) return countDays(tip.getStartAt(), tip.getEndAt());
  let total = 0;
  for (const r of alive) {
    total += countDays(r.getStartAt(), r.getEndAt());
  }
  return total;
}

/**
 * Indica si una reserva puede transicionar a `cancelled` desde su estado
 * actual. Refleja la guarda del método `Reservation.cancel()`.
 */
function isCancelable(r: Reservation): boolean {
  return (
    r.isPendingPayment() ||
    r.isPendingApproval() ||
    r.isPendingBalance() ||
    r.isConfirmed() ||
    r.isInProgress()
  );
}

/**
 * Devuelve el eslabón objetivo y todos sus descendientes en la cadena (las
 * extensiones que cuelgan de él, directa o transitivamente). No incluye a sus
 * ancestros: cancelar una extensión no debe afectar la parte del alquiler ya
 * comprometida (el original en curso y las extensiones anteriores).
 */
function collectDescendants(
  targetId: string,
  chain: Reservation[],
): Reservation[] {
  const byId = new Map(chain.map((r) => [r.getId(), r]));
  const reachesTarget = (r: Reservation): boolean => {
    let cur: Reservation | undefined = r;
    while (cur) {
      if (cur.getId() === targetId) return true;
      const parentId = cur.getParentReservationId();
      cur = parentId ? byId.get(parentId) : undefined;
    }
    return false;
  };
  return chain.filter(reachesTarget);
}

function isExclusionViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const anyE = e as { code?: string; meta?: { code?: string } };
  if (anyE.code === '23P01') return true;
  if (anyE.meta?.code === '23P01') return true;
  const msg = (e as Error).message ?? '';
  return msg.includes('reservations_no_overlap');
}
