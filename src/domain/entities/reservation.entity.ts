import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  CancellationPolicySchema,
  DepositPercentageSchema,
  MaxKilometrageSchema,
  RentalTimeConstraintsSchema,
  ReservationStatusSchema,
  type CancellationPolicy,
  type MaxKilometrage,
  type RentalTimeConstraints,
  type PricingQuote,
  PricingQuoteSchema,
  type ReservationAddress,
} from '@rocket-lease/contracts';
import { InvalidEntityDataException } from '../exceptions/domain.exception';
import {
  BalanceNotDueException,
  BalanceOverdueException,
  ContractNotAcceptedException,
  DepositNotAvailableException,
  InvalidQrTokenException,
  InvalidReservationTransitionException,
  TransferExpiredException,
} from '../exceptions/reservation.exception';

export const RESERVATION_STATUS = ReservationStatusSchema.enum;

const PaymentMethodEnum = z.enum([
  'credit_card',
  'debit_card',
  'bank_transfer',
  'digital_wallet',
]);

export const WalletProviderEnum = z.enum(['mercadopago', 'uala']);

const ReservationAddressSchemaInternal = z.object({
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).nullable();

const reservationSchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  conductorId: z.string().uuid(),
  rentadorId: z.string().uuid(),
  status: ReservationStatusSchema,
  startAt: z.date(),
  endAt: z.date(),
  holdExpiresAt: z.date().nullable(),
  totalCents: z.number().int().nonnegative(),
  currency: z.literal('ARS'),
  paymentMethod: PaymentMethodEnum.nullable(),
  walletProvider: WalletProviderEnum.nullable(),
  contractAcceptedAt: z.date().nullable(),
  paidAt: z.date().nullable(),
  voucherToken: z.string().uuid().nullable(),
  returnQrToken: z.string().uuid().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  rejectionReason: z.string().max(280).nullable(),
  transferExpiresAt: z.date().nullable(),
  transferCode: z.string().nullable(),
  transferAlias: z.string().nullable(),
  transferPaymentMode: z.enum(['full', 'deposit', 'balance']).nullable(),
  depositPaidCents: z.number().int().nonnegative().nullable(),
  depositPaidAt: z.date().nullable(),
  balanceDueAt: z.date().nullable(),
  balanceReminderSentAt: z.date().nullable(),
  depositPercentageSnapshot: DepositPercentageSchema,
  basePriceCentsSnapshot: z.number().int().nonnegative(),
  pricingSnapshot: PricingQuoteSchema.nullable(),
  cancellationPolicySnapshot: CancellationPolicySchema,
  maxKilometrageSnapshot: MaxKilometrageSchema,
  rentalTimeConstraintsSnapshot: RentalTimeConstraintsSchema,
  withHomeDelivery: z.boolean(),
  homeDeliveryFeeCentsSnapshot: z.number().int().nonnegative().nullable(),
  deliveryAddress: ReservationAddressSchemaInternal,
  withHomeReturn: z.boolean(),
  homeReturnFeeCentsSnapshot: z.number().int().nonnegative().nullable(),
  returnAddress: ReservationAddressSchemaInternal,
  parentReservationId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Defaults aplicados al snapshotear una reserva cuyo vehículo no tiene set
 * de reglas asignado.
 */
export const RESERVATION_RULES_DEFAULTS = {
  cancellationPolicy: 'FLEXIBLE' as CancellationPolicy,
  maxKilometrage: { type: 'UNLIMITED' } as MaxKilometrage,
  rentalTimeConstraints: { minDays: 1 } as RentalTimeConstraints,
  depositPercentage: null,
} as const;

export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;
export type WalletProvider = z.infer<typeof WalletProviderEnum>;

export type TransferPaymentMode = 'full' | 'deposit' | 'balance';

export const BLOCKING_STATUSES: ReservationStatus[] = [
  RESERVATION_STATUS.pending_payment,
  RESERVATION_STATUS.pending_balance,
  RESERVATION_STATUS.confirmed,
  RESERVATION_STATUS.in_progress,
];

export const HOLD_TTL_MS = 10 * 60 * 1000;
export const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

export const CASCADE_REJECTION_REASON =
  'El vehículo fue reservado por otro conductor para fechas que se solapan.';
export const TRANSFER_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Razón canónica con la que se cancela una reserva señada cuyo saldo venció.
 * El job de expiración la persiste en `rejectionReason` y la web la mapea a
 * un string de usuario.
 */
export const BALANCE_OVERDUE_REASON = 'BALANCE_OVERDUE';

// Ventana para pagar el saldo de una reserva señada (US-26/US-30):
// vence 24h antes del retiro o 7 días tras pagar la seña, lo que ocurra
// primero, con un piso de 1h para no dejar deadlines en el pasado.
export const BALANCE_BUFFER_BEFORE_START_MS = 24 * 60 * 60 * 1000;
export const BALANCE_MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const BALANCE_MIN_WINDOW_MS = 60 * 60 * 1000;

/**
 * Calcula la fecha límite para pagar el saldo de una reserva señada:
 * `max(now + 1h, min(startAt - 24h, depositPaidAt + 7d))`.
 */
export function computeBalanceDueAt(now: Date, startAt: Date): Date {
  const beforeStart = startAt.getTime() - BALANCE_BUFFER_BEFORE_START_MS;
  const maxWindow = now.getTime() + BALANCE_MAX_WINDOW_MS;
  const minWindow = now.getTime() + BALANCE_MIN_WINDOW_MS;
  return new Date(Math.max(minWindow, Math.min(beforeStart, maxWindow)));
}

export interface ReservationProps {
  id?: string;
  vehicleId: string;
  conductorId: string;
  rentadorId: string;
  status?: ReservationStatus;
  startAt: Date;
  endAt: Date;
  holdExpiresAt: Date | null;
  totalCents: number;
  currency?: 'ARS';
  paymentMethod?: PaymentMethod | null;
  walletProvider?: WalletProvider | null;
  contractAcceptedAt: Date | null;
  paidAt?: Date | null;
  voucherToken?: string | null;
  returnQrToken?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  rejectionReason?: string | null;
  transferExpiresAt?: Date | null;
  transferCode?: string | null;
  transferAlias?: string | null;
  transferPaymentMode?: TransferPaymentMode | null;
  depositPaidCents?: number | null;
  depositPaidAt?: Date | null;
  balanceDueAt?: Date | null;
  balanceReminderSentAt?: Date | null;
  depositPercentageSnapshot?: number | null;
  basePriceCentsSnapshot?: number;
  pricingSnapshot?: PricingQuote | null;
  cancellationPolicySnapshot?: CancellationPolicy;
  maxKilometrageSnapshot?: MaxKilometrage;
  rentalTimeConstraintsSnapshot?: RentalTimeConstraints;
  withHomeDelivery?: boolean;
  homeDeliveryFeeCentsSnapshot?: number | null;
  deliveryAddress?: ReservationAddress | null;
  withHomeReturn?: boolean;
  homeReturnFeeCentsSnapshot?: number | null;
  returnAddress?: ReservationAddress | null;
  parentReservationId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Reservation {
  private readonly id: string;
  private readonly vehicleId: string;
  private readonly conductorId: string;
  private readonly rentadorId: string;
  private status: ReservationStatus;
  private readonly startAt: Date;
  private endAt: Date;
  private holdExpiresAt: Date | null;
  private totalCents: number;
  private readonly currency: 'ARS';
  private paymentMethod: PaymentMethod | null;
  private walletProvider: WalletProvider | null;
  private contractAcceptedAt: Date | null;
  private paidAt: Date | null;
  private voucherToken: string | null;
  private returnQrToken: string | null;
  private startedAt: Date | null;
  private completedAt: Date | null;
  private rejectionReason: string | null;
  private transferExpiresAt: Date | null;
  private transferCode: string | null;
  private transferAlias: string | null;
  private transferPaymentMode: TransferPaymentMode | null;
  private depositPaidCents: number | null;
  private depositPaidAt: Date | null;
  private balanceDueAt: Date | null;
  private balanceReminderSentAt: Date | null;
  private depositPercentageSnapshot: number | null;
  private basePriceCentsSnapshot: number;
  private pricingSnapshot: PricingQuote | null;
  private cancellationPolicySnapshot: CancellationPolicy;
  private maxKilometrageSnapshot: MaxKilometrage;
  private rentalTimeConstraintsSnapshot: RentalTimeConstraints;
  private readonly withHomeDelivery: boolean;
  private readonly homeDeliveryFeeCentsSnapshot: number | null;
  private readonly deliveryAddress: ReservationAddress | null;
  private readonly withHomeReturn: boolean;
  private readonly homeReturnFeeCentsSnapshot: number | null;
  private readonly returnAddress: ReservationAddress | null;
  private readonly parentReservationId: string | null;
  private readonly createdAt: Date;
  private updatedAt: Date;

  /**
   * Construye un eslabón nuevo de la cadena de reservas a partir de un padre
   * existente. El padre puede ser la reserva original o la última extensión
   * confirmada del chain — la continuidad se garantiza fijando `startAt` al
   * `endAt` del padre. El snapshot de reglas se pasa explícito porque debe
   * tomarse del set actual del vehículo (no se hereda del padre), y el
   * `paymentMethod` + `walletProvider` se copian del padre para soportar el
   * cobro automático sin reingresar datos del conductor.
   */
  public static fromExtensionRequest(params: {
    parent: Reservation;
    newEndAt: Date;
    totalCents: number;
    status: ReservationStatus;
    holdExpiresAt: Date;
    snapshot: {
      depositPercentage: number | null;
      basePriceCents: number;
      pricingSnapshot: PricingQuote;
      cancellationPolicy: CancellationPolicy;
      maxKilometrage: MaxKilometrage;
      rentalTimeConstraints: RentalTimeConstraints;
    };
    now: Date;
  }): Reservation {
    return new Reservation({
      vehicleId: params.parent.getVehicleId(),
      conductorId: params.parent.getConductorId(),
      rentadorId: params.parent.getRentadorId(),
      status: params.status,
      startAt: params.parent.getEndAt(),
      endAt: params.newEndAt,
      holdExpiresAt: params.holdExpiresAt,
      totalCents: params.totalCents,
      currency: 'ARS',
      paymentMethod: params.parent.getPaymentMethod(),
      walletProvider: params.parent.getWalletProvider(),
      contractAcceptedAt: params.now,
      paidAt: null,
      depositPercentageSnapshot: params.snapshot.depositPercentage,
      basePriceCentsSnapshot: params.snapshot.basePriceCents,
      pricingSnapshot: params.snapshot.pricingSnapshot,
      cancellationPolicySnapshot: params.snapshot.cancellationPolicy,
      maxKilometrageSnapshot: params.snapshot.maxKilometrage,
      rentalTimeConstraintsSnapshot: params.snapshot.rentalTimeConstraints,
      parentReservationId: params.parent.getId(),
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  constructor(props: ReservationProps) {
    this.id = props.id ?? randomUUID();
    this.vehicleId = props.vehicleId;
    this.conductorId = props.conductorId;
    this.rentadorId = props.rentadorId;
    this.status = props.status ?? RESERVATION_STATUS.pending_payment;
    this.startAt = props.startAt;
    this.endAt = props.endAt;
    this.holdExpiresAt = props.holdExpiresAt;
    this.totalCents = props.totalCents;
    this.currency = props.currency ?? 'ARS';
    this.paymentMethod = props.paymentMethod ?? null;
    this.walletProvider = props.walletProvider ?? null;
    this.contractAcceptedAt = props.contractAcceptedAt;
    this.paidAt = props.paidAt ?? null;
    this.voucherToken = props.voucherToken ?? null;
    this.returnQrToken = props.returnQrToken ?? null;
    this.startedAt = props.startedAt ?? null;
    this.completedAt = props.completedAt ?? null;
    this.rejectionReason = props.rejectionReason ?? null;
    this.transferExpiresAt = props.transferExpiresAt ?? null;
    this.transferCode = props.transferCode ?? null;
    this.transferAlias = props.transferAlias ?? null;
    this.transferPaymentMode = props.transferPaymentMode ?? null;
    this.depositPaidCents = props.depositPaidCents ?? null;
    this.depositPaidAt = props.depositPaidAt ?? null;
    this.balanceDueAt = props.balanceDueAt ?? null;
    this.balanceReminderSentAt = props.balanceReminderSentAt ?? null;
    this.depositPercentageSnapshot =
      props.depositPercentageSnapshot ?? RESERVATION_RULES_DEFAULTS.depositPercentage;
    this.basePriceCentsSnapshot = props.basePriceCentsSnapshot ?? 0;
    this.pricingSnapshot = props.pricingSnapshot ?? null;
    this.cancellationPolicySnapshot =
      props.cancellationPolicySnapshot ?? RESERVATION_RULES_DEFAULTS.cancellationPolicy;
    this.maxKilometrageSnapshot =
      props.maxKilometrageSnapshot ?? RESERVATION_RULES_DEFAULTS.maxKilometrage;
    this.rentalTimeConstraintsSnapshot =
      props.rentalTimeConstraintsSnapshot ?? RESERVATION_RULES_DEFAULTS.rentalTimeConstraints;
    this.withHomeDelivery = props.withHomeDelivery ?? false;
    this.homeDeliveryFeeCentsSnapshot = props.homeDeliveryFeeCentsSnapshot ?? null;
    this.deliveryAddress = props.deliveryAddress ?? null;
    this.withHomeReturn = props.withHomeReturn ?? false;
    this.homeReturnFeeCentsSnapshot = props.homeReturnFeeCentsSnapshot ?? null;
    this.returnAddress = props.returnAddress ?? null;
    this.parentReservationId = props.parentReservationId ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? this.createdAt;
    this.validate();
    if (this.endAt.getTime() <= this.startAt.getTime()) {
      throw new InvalidEntityDataException('endAt must be after startAt');
    }
  }

  public getId() {
    return this.id;
  }
  public getVehicleId() {
    return this.vehicleId;
  }
  public getConductorId() {
    return this.conductorId;
  }
  public getRentadorId() {
    return this.rentadorId;
  }
  public getStatus() {
    return this.status;
  }
  public getStartAt() {
    return this.startAt;
  }
  public getEndAt() {
    return this.endAt;
  }
  public getHoldExpiresAt() {
    return this.holdExpiresAt;
  }
  public getTotalCents() {
    return this.totalCents;
  }
  public getCurrency() {
    return this.currency;
  }
  public getPaymentMethod() {
    return this.paymentMethod;
  }
  public getWalletProvider() {
    return this.walletProvider;
  }
  public getContractAcceptedAt() {
    return this.contractAcceptedAt;
  }
  public getPaidAt() {
    return this.paidAt;
  }
  public getVoucherToken() {
    return this.voucherToken;
  }
  public getReturnQrToken() {
    return this.returnQrToken;
  }
  public getStartedAt() {
    return this.startedAt;
  }
  public getCompletedAt() {
    return this.completedAt;
  }
  public getRejectionReason() {
    return this.rejectionReason;
  }
  public getTransferExpiresAt() {
    return this.transferExpiresAt;
  }
  public getTransferCode() {
    return this.transferCode;
  }
  public getTransferAlias() {
    return this.transferAlias;
  }
  public getTransferPaymentMode(): TransferPaymentMode | null {
    return this.transferPaymentMode;
  }
  public getDepositPaidCents(): number | null {
    return this.depositPaidCents;
  }
  public getDepositPaidAt(): Date | null {
    return this.depositPaidAt;
  }
  public getBalanceDueAt(): Date | null {
    return this.balanceDueAt;
  }
  public getBalanceReminderSentAt(): Date | null {
    return this.balanceReminderSentAt;
  }
  /**
   * Saldo pendiente de cobro. Para reservas señadas es `total - seña`; para
   * el resto (sin seña pagada) coincide con el total.
   */
  public getBalanceCents(): number {
    return this.totalCents - (this.depositPaidCents ?? 0);
  }
  public getDepositPercentageSnapshot(): number | null {
    return this.depositPercentageSnapshot;
  }
  public getBasePriceCentsSnapshot(): number {
    return this.basePriceCentsSnapshot;
  }
  public getPricingSnapshot(): PricingQuote | null {
    return this.pricingSnapshot;
  }
  public getCancellationPolicySnapshot(): CancellationPolicy {
    return this.cancellationPolicySnapshot;
  }
  public getMaxKilometrageSnapshot(): MaxKilometrage {
    return this.maxKilometrageSnapshot;
  }
  public getRentalTimeConstraintsSnapshot(): RentalTimeConstraints {
    return this.rentalTimeConstraintsSnapshot;
  }
  public getParentReservationId(): string | null {
    return this.parentReservationId;
  }
  public getWithHomeDelivery(): boolean {
    return this.withHomeDelivery;
  }
  public getHomeDeliveryFeeCentsSnapshot(): number | null {
    return this.homeDeliveryFeeCentsSnapshot;
  }
  public getDeliveryAddress(): ReservationAddress | null {
    return this.deliveryAddress;
  }
  public getWithHomeReturn(): boolean {
    return this.withHomeReturn;
  }
  public getHomeReturnFeeCentsSnapshot(): number | null {
    return this.homeReturnFeeCentsSnapshot;
  }
  public getReturnAddress(): ReservationAddress | null {
    return this.returnAddress;
  }
  public getCreatedAt() {
    return this.createdAt;
  }
  public getUpdatedAt() {
    return this.updatedAt;
  }

  /**
   * Aplica el snapshot de reglas + precio sobre la reserva. Se invoca al
   * confirmar (`pending_payment → confirmed`) para congelar las condiciones
   * que ve el conductor al momento de pagar, de forma que cambios posteriores
   * al set o al precio del vehículo no afecten reservas confirmadas.
   *
   * Si el vehículo no tiene set asignado, se pasan los defaults
   * `RESERVATION_RULES_DEFAULTS` desde el service.
   */
  public applyRulesSnapshot(snapshot: {
    depositPercentage: number | null;
    basePriceCents: number;
    cancellationPolicy: CancellationPolicy;
    maxKilometrage: MaxKilometrage;
    rentalTimeConstraints: RentalTimeConstraints;
  }): void {
    if (!this.isPendingPayment() && !this.isPendingApproval()) {
      throw new InvalidEntityDataException(
        'rules snapshot can only be applied before confirmation',
      );
    }
    this.depositPercentageSnapshot = snapshot.depositPercentage;
    if (this.basePriceCentsSnapshot <= 0) {
      this.basePriceCentsSnapshot = snapshot.basePriceCents;
    }
    this.cancellationPolicySnapshot = snapshot.cancellationPolicy;
    this.maxKilometrageSnapshot = snapshot.maxKilometrage;
    this.rentalTimeConstraintsSnapshot = snapshot.rentalTimeConstraints;
    this.validate();
  }

  /**
   * Modifica una extensión pendiente: ajusta la fecha de devolución, el total,
   * el estado (puede pasar entre `pending_approval` y `pending_payment` según
   * el recálculo), el hold y el snapshot de reglas vigente. Solo válido para
   * eslabones que sean extensiones (`parentReservationId` no nulo) y todavía
   * estén pendientes.
   */
  public modifyExtension(params: {
    newEndAt: Date;
    totalCents: number;
    status: ReservationStatus;
    holdExpiresAt: Date;
    snapshot: {
      depositPercentage: number | null;
      basePriceCents: number;
      pricingSnapshot: PricingQuote;
      cancellationPolicy: CancellationPolicy;
      maxKilometrage: MaxKilometrage;
      rentalTimeConstraints: RentalTimeConstraints;
    };
    now: Date;
  }): void {
    if (this.parentReservationId === null) {
      throw new InvalidEntityDataException('only extensions can be modified');
    }
    if (!this.isPendingApproval() && !this.isPendingPayment()) {
      throw new InvalidEntityDataException(
        'only pending extensions can be modified',
      );
    }
    if (params.newEndAt.getTime() <= this.startAt.getTime()) {
      throw new InvalidEntityDataException('endAt must be after startAt');
    }
    this.endAt = params.newEndAt;
    this.totalCents = params.totalCents;
    this.status = params.status;
    this.holdExpiresAt = params.holdExpiresAt;
    this.depositPercentageSnapshot = params.snapshot.depositPercentage;
    this.basePriceCentsSnapshot = params.snapshot.basePriceCents;
    this.pricingSnapshot = params.snapshot.pricingSnapshot;
    this.cancellationPolicySnapshot = params.snapshot.cancellationPolicy;
    this.maxKilometrageSnapshot = params.snapshot.maxKilometrage;
    this.rentalTimeConstraintsSnapshot = params.snapshot.rentalTimeConstraints;
    this.updatedAt = params.now;
    this.validate();
  }

  public isOwnedByConductor(conductorId: string): boolean {
    return this.conductorId === conductorId;
  }

  public isOwnedByRentador(rentadorId: string): boolean {
    return this.rentadorId === rentadorId;
  }

  public isHoldExpired(now: Date): boolean {
    if (!this.isPendingPayment() && !this.isPendingApproval()) return false;
    if (!this.holdExpiresAt) return false;
    return this.holdExpiresAt.getTime() <= now.getTime();
  }

  public isTransferExpired(now: Date): boolean {
    if (!this.isPendingApproval()) return false;
    if (!this.transferExpiresAt) return false;
    return this.transferExpiresAt.getTime() <= now.getTime();
  }

  public isPendingApproval(): boolean { return this.status === RESERVATION_STATUS.pending_approval; }
  public isPendingPayment(): boolean { return this.status === RESERVATION_STATUS.pending_payment; }
  public isPendingBalance(): boolean { return this.status === RESERVATION_STATUS.pending_balance; }
  public isConfirmed(): boolean { return this.status === RESERVATION_STATUS.confirmed; }
  public isInProgress(): boolean { return this.status === RESERVATION_STATUS.in_progress; }
  public isCancelled(): boolean { return this.status === RESERVATION_STATUS.cancelled; }
  public isExpired(): boolean { return this.status === RESERVATION_STATUS.expired; }

  /**
   * Confirma el pago inmediato (tarjeta crédito, débito, billetera virtual).
   * Transita de pending_payment → confirmed.
   */
  public confirmPayment(
    method: PaymentMethod,
    now: Date,
    walletProvider?: WalletProvider,
  ): void {
    if (!this.isPendingPayment() && !this.isPendingApproval()) {
      throw new InvalidReservationTransitionException(this.status, RESERVATION_STATUS.confirmed);
    }
    if (!this.contractAcceptedAt) {
      throw new ContractNotAcceptedException();
    }
    if (method === 'digital_wallet' && !walletProvider) {
      throw new InvalidEntityDataException(
        'walletProvider is required for digital_wallet',
      );
    }
    this.status = RESERVATION_STATUS.confirmed;
    this.paymentMethod = method;
    this.walletProvider = walletProvider ?? null;
    this.paidAt = now;
    this.voucherToken = randomUUID();
    this.holdExpiresAt = null;
    this.updatedAt = now;
  }

  /**
   * Inicia pago por transferencia bancaria.
   * Transita de pending_payment → pending_approval.
   * Genera un código CBU/CVU simulado y establece expiración a 2h.
   */
  public initiateBankTransfer(
    now: Date,
    transferCode: string,
    transferAlias: string,
    mode: TransferPaymentMode = 'full',
  ): void {
    if (!this.isPendingPayment() && !this.isPendingApproval()) {
      throw new InvalidReservationTransitionException(
        this.status,
        RESERVATION_STATUS.pending_approval,
      );
    }
    if (!this.contractAcceptedAt) {
      throw new ContractNotAcceptedException();
    }
    if (mode === 'deposit' && this.depositPercentageSnapshot === null) {
      throw new DepositNotAvailableException(this.id);
    }
    this.status = RESERVATION_STATUS.pending_approval;
    this.paymentMethod = 'bank_transfer';
    this.transferCode = transferCode;
    this.transferAlias = transferAlias;
    this.transferExpiresAt = new Date(now.getTime() + TRANSFER_TTL_MS);
    this.transferPaymentMode = mode;
    this.holdExpiresAt = null;
    this.updatedAt = now;
  }

  /**
   * Confirma la acreditación de una transferencia bancaria.
   * Transita de pending_approval → confirmed.
   */
  public confirmTransferPayment(now: Date): void {
    if (!this.isPendingApproval()) {
      throw new InvalidReservationTransitionException(
        this.status,
        RESERVATION_STATUS.confirmed,
      );
    }
    if (this.isTransferExpired(now)) {
      throw new TransferExpiredException(this.id);
    }
    this.status = RESERVATION_STATUS.confirmed;
    this.paidAt = now;
    this.voucherToken = randomUUID();
    this.transferExpiresAt = null;
    this.updatedAt = now;
  }

  /**
   * Estado interno compartido al acreditar una seña (vía tarjeta/billetera o
   * vía transferencia). Transita la reserva a `pending_balance`, registra el
   * monto de la seña y fija la fecha límite para pagar el saldo.
   */
  private applyDepositPaid(
    method: PaymentMethod,
    depositCents: number,
    now: Date,
    walletProvider?: WalletProvider,
  ): void {
    if (this.depositPercentageSnapshot === null) {
      throw new DepositNotAvailableException(this.id);
    }
    this.status = RESERVATION_STATUS.pending_balance;
    this.paymentMethod = method;
    this.walletProvider = walletProvider ?? null;
    this.depositPaidCents = depositCents;
    this.depositPaidAt = now;
    this.balanceDueAt = computeBalanceDueAt(now, this.startAt);
    this.holdExpiresAt = null;
    this.transferExpiresAt = null;
    this.transferPaymentMode = null;
    this.updatedAt = now;
    this.validate();
  }

  /**
   * Confirma el pago de una seña por medio inmediato (tarjeta/billetera).
   * Transita de pending_payment → pending_balance (US-26).
   */
  public payDeposit(
    method: PaymentMethod,
    depositCents: number,
    now: Date,
    walletProvider?: WalletProvider,
  ): void {
    if (!this.isPendingPayment() && !this.isPendingApproval()) {
      throw new InvalidReservationTransitionException(
        this.status,
        RESERVATION_STATUS.pending_balance,
      );
    }
    if (!this.contractAcceptedAt) {
      throw new ContractNotAcceptedException();
    }
    if (method === 'digital_wallet' && !walletProvider) {
      throw new InvalidEntityDataException(
        'walletProvider is required for digital_wallet',
      );
    }
    this.applyDepositPaid(method, depositCents, now, walletProvider);
  }

  /**
   * Acredita una seña pagada por transferencia bancaria.
   * Transita de pending_approval → pending_balance (US-26).
   */
  public confirmTransferAsDeposit(depositCents: number, now: Date): void {
    if (!this.isPendingApproval()) {
      throw new InvalidReservationTransitionException(
        this.status,
        RESERVATION_STATUS.pending_balance,
      );
    }
    if (this.isTransferExpired(now)) {
      throw new TransferExpiredException(this.id);
    }
    this.applyDepositPaid('bank_transfer', depositCents, now);
  }

  /**
   * Paga el saldo restante de una reserva señada por medio inmediato.
   * Transita de pending_balance → confirmed (US-30) y genera el voucher.
   */
  public payBalance(
    method: PaymentMethod,
    now: Date,
    walletProvider?: WalletProvider,
  ): void {
    if (!this.isPendingBalance()) {
      throw new BalanceNotDueException(this.id);
    }
    if (this.isBalanceOverdue(now)) {
      throw new BalanceOverdueException(this.id);
    }
    if (method === 'digital_wallet' && !walletProvider) {
      throw new InvalidEntityDataException(
        'walletProvider is required for digital_wallet',
      );
    }
    this.status = RESERVATION_STATUS.confirmed;
    this.paymentMethod = method;
    this.walletProvider = walletProvider ?? this.walletProvider;
    this.paidAt = now;
    this.voucherToken = randomUUID();
    this.updatedAt = now;
  }

  /**
   * Inicia el pago del saldo por transferencia bancaria sobre una reserva
   * señada. No cambia el estado (sigue `pending_balance`); marca el modo de
   * transferencia como `balance` para que la acreditación cierre la reserva.
   */
  public initiateBalanceTransfer(
    now: Date,
    transferCode: string,
    transferAlias: string,
  ): void {
    if (!this.isPendingBalance()) {
      throw new BalanceNotDueException(this.id);
    }
    if (this.isBalanceOverdue(now)) {
      throw new BalanceOverdueException(this.id);
    }
    this.paymentMethod = 'bank_transfer';
    this.transferCode = transferCode;
    this.transferAlias = transferAlias;
    this.transferExpiresAt = new Date(now.getTime() + TRANSFER_TTL_MS);
    this.transferPaymentMode = 'balance';
    this.updatedAt = now;
  }

  /**
   * Acredita el saldo pagado por transferencia.
   * Transita de pending_balance → confirmed (US-30).
   */
  public confirmBalanceTransfer(now: Date): void {
    if (!this.isPendingBalance()) {
      throw new BalanceNotDueException(this.id);
    }
    if (!this.transferCode) {
      throw new InvalidReservationTransitionException(
        this.status,
        RESERVATION_STATUS.confirmed,
      );
    }
    if (this.transferExpiresAt && this.transferExpiresAt.getTime() <= now.getTime()) {
      throw new TransferExpiredException(this.id);
    }
    this.status = RESERVATION_STATUS.confirmed;
    this.paidAt = now;
    this.voucherToken = randomUUID();
    this.transferExpiresAt = null;
    this.transferPaymentMode = null;
    this.updatedAt = now;
  }

  public isBalanceOverdue(now: Date): boolean {
    if (!this.isPendingBalance()) return false;
    if (!this.balanceDueAt) return false;
    return this.balanceDueAt.getTime() <= now.getTime();
  }

  /**
   * Cancela automáticamente una reserva señada cuyo saldo no se pagó a tiempo.
   * Transita de pending_balance → cancelled (US-26). El reembolso de la seña
   * según la política de cancelación lo resuelve el service.
   */
  public expireOverdueBalance(now: Date): void {
    if (!this.isPendingBalance()) {
      throw new InvalidReservationTransitionException(
        this.status,
        RESERVATION_STATUS.cancelled,
      );
    }
    this.status = RESERVATION_STATUS.cancelled;
    this.rejectionReason = BALANCE_OVERDUE_REASON;
    this.holdExpiresAt = null;
    this.transferExpiresAt = null;
    this.updatedAt = now;
  }

  /** Marca que ya se envió el recordatorio de saldo (idempotencia del job). */
  public markBalanceReminderSent(now: Date): void {
    this.balanceReminderSentAt = now;
    this.updatedAt = now;
  }

  /**
   * Expira una transferencia no acreditada.
   * Transita de pending_approval → cancelled.
   */
  public expireTransfer(now: Date): void {
    if (!this.isPendingApproval()) {
      throw new InvalidReservationTransitionException(this.status, RESERVATION_STATUS.cancelled);
    }
    this.status = RESERVATION_STATUS.cancelled;
    this.transferExpiresAt = null;
    this.updatedAt = now;
  }

  public markExpired(now: Date): void {
    if (!this.isPendingPayment()) {
      throw new InvalidReservationTransitionException(this.status, RESERVATION_STATUS.expired);
    }
    this.status = RESERVATION_STATUS.expired;
    this.holdExpiresAt = null;
    this.updatedAt = now;
  }

  /**
   * Acepta la solicitud del conductor: transiciona `pending_approval → pending_payment`
   * y abre el hold de 10 minutos para que pague.
   *
   * @param now - Instante actual usado para calcular `holdExpiresAt` y `updatedAt`.
   */
  public approve(now: Date): void {
    if (!this.isPendingApproval()) {
      throw new InvalidReservationTransitionException(
        this.status,
        RESERVATION_STATUS.pending_payment,
      );
    }
    this.status = RESERVATION_STATUS.pending_payment;
    this.holdExpiresAt = new Date(now.getTime() + HOLD_TTL_MS);
    this.updatedAt = now;
  }

  /**
   * Rechaza una solicitud `pending_approval` con razón opcional (max 280 chars).
   * Se persiste la razón en `rejectionReason` para que el conductor la vea en el detalle.
   *
   * @param reason - Motivo del rechazo. `null` o string vacío se normalizan a `null`.
   *   El límite de 280 chars se valida en el contract (Zod) antes de llegar acá.
   * @param now - Instante actual usado para `updatedAt`.
   */
  public reject(reason: string | null, now: Date): void {
    if (!this.isPendingApproval()) {
      throw new InvalidReservationTransitionException(this.status, RESERVATION_STATUS.rejected);
    }
    this.status = RESERVATION_STATUS.rejected;
    this.rejectionReason = reason && reason.length > 0 ? reason : null;
    this.holdExpiresAt = null;
    this.updatedAt = now;
  }

  /**
   * Marca como expirada una solicitud `pending_approval` cuyo TTL (24h) venció
   * sin respuesta del rentador. Libera el slot.
   *
   * @param now - Instante actual usado para `updatedAt`.
   */
  public markApprovalExpired(now: Date): void {
    if (!this.isPendingApproval()) {
      throw new InvalidReservationTransitionException(this.status, RESERVATION_STATUS.expired);
    }
    this.status = RESERVATION_STATUS.expired;
    this.holdExpiresAt = null;
    this.updatedAt = now;
  }

  /**
   * Cancela una reserva que todavía no fue confirmada (incluye `pending_payment`
   * y `pending_approval`). Se usa cuando el conductor desiste/retira la solicitud,
   * o cuando el rentador deshabilita el vehículo (cascade).
   *
   * @param now - Instante actual usado para `updatedAt`.
   */
  public cancel(now: Date): void {
    if (
      !this.isPendingPayment() &&
      !this.isPendingApproval() &&
      !this.isPendingBalance() &&
      !this.isConfirmed() &&
      !this.isInProgress()
    ) {
      throw new InvalidReservationTransitionException(this.status, RESERVATION_STATUS.cancelled);
    }
    this.status = RESERVATION_STATUS.cancelled;
    this.holdExpiresAt = null;
    this.updatedAt = now;
  }

  public cancelByRentador(now: Date, reason?: string | null): void {
    if (
      !this.isPendingPayment() &&
      !this.isPendingApproval() &&
      !this.isPendingBalance() &&
      !this.isConfirmed() &&
      !this.isInProgress()
    ) {
      throw new InvalidReservationTransitionException(this.status, RESERVATION_STATUS.cancelled);
    }
    this.status = RESERVATION_STATUS.cancelled;
    if (reason) {
      this.rejectionReason = reason;
    }
    this.holdExpiresAt = null;
    this.updatedAt = now;
  }

  public confirmPickup(now: Date): void {
    if (!this.isConfirmed()) {
      throw new InvalidReservationTransitionException(this.status, RESERVATION_STATUS.in_progress);
    }
    this.status = RESERVATION_STATUS.in_progress;
    this.startedAt = now;
    this.returnQrToken = randomUUID();
    this.updatedAt = now;
  }

  public confirmReturn(token: string, now: Date): void {
    if (!this.isInProgress()) {
      throw new InvalidReservationTransitionException(this.status, RESERVATION_STATUS.completed);
    }
    if (this.returnQrToken !== token) {
      throw new InvalidQrTokenException();
    }
    this.status = RESERVATION_STATUS.completed;
    this.completedAt = now;
    this.updatedAt = now;
  }

  /**
   * Completes a chain extension when the root reservation is returned. An
   * extension can be in `confirmed` (paid but not yet handed off, since the
   * car never left) or `in_progress`. Both are valid targets.
   */
  public completeFromChain(now: Date): void {
    if (!this.isInProgress() && !this.isConfirmed()) {
      throw new InvalidReservationTransitionException(this.status, RESERVATION_STATUS.completed);
    }
    this.status = RESERVATION_STATUS.completed;
    this.completedAt = now;
    this.updatedAt = now;
  }

  private validate(): void {
    const result = reservationSchema.safeParse({
      id: this.id,
      vehicleId: this.vehicleId,
      conductorId: this.conductorId,
      rentadorId: this.rentadorId,
      status: this.status,
      startAt: this.startAt,
      endAt: this.endAt,
      holdExpiresAt: this.holdExpiresAt,
      totalCents: this.totalCents,
      currency: this.currency,
      paymentMethod: this.paymentMethod,
      walletProvider: this.walletProvider,
      contractAcceptedAt: this.contractAcceptedAt,
      paidAt: this.paidAt,
      voucherToken: this.voucherToken,
      returnQrToken: this.returnQrToken,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      rejectionReason: this.rejectionReason,
      transferExpiresAt: this.transferExpiresAt,
      transferCode: this.transferCode,
      transferAlias: this.transferAlias,
      transferPaymentMode: this.transferPaymentMode,
      depositPaidCents: this.depositPaidCents,
      depositPaidAt: this.depositPaidAt,
      balanceDueAt: this.balanceDueAt,
      balanceReminderSentAt: this.balanceReminderSentAt,
      depositPercentageSnapshot: this.depositPercentageSnapshot,
      basePriceCentsSnapshot: this.basePriceCentsSnapshot,
      pricingSnapshot: this.pricingSnapshot,
      cancellationPolicySnapshot: this.cancellationPolicySnapshot,
      maxKilometrageSnapshot: this.maxKilometrageSnapshot,
      rentalTimeConstraintsSnapshot: this.rentalTimeConstraintsSnapshot,
      withHomeDelivery: this.withHomeDelivery,
      homeDeliveryFeeCentsSnapshot: this.homeDeliveryFeeCentsSnapshot,
      deliveryAddress: this.deliveryAddress,
      withHomeReturn: this.withHomeReturn,
      homeReturnFeeCentsSnapshot: this.homeReturnFeeCentsSnapshot,
      returnAddress: this.returnAddress,
      parentReservationId: this.parentReservationId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }
}
