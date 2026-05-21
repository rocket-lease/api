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
} from '@rocket-lease/contracts';
import { InvalidEntityDataException } from '../exceptions/domain.exception';
import {
  ContractNotAcceptedException,
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
  depositPercentageSnapshot: DepositPercentageSchema,
  basePriceCentsSnapshot: z.number().int().nonnegative(),
  cancellationPolicySnapshot: CancellationPolicySchema,
  maxKilometrageSnapshot: MaxKilometrageSchema,
  rentalTimeConstraintsSnapshot: RentalTimeConstraintsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Defaults aplicados al snapshotear una reserva cuyo vehículo no tiene set
 * de reglas asignado (acceptance criterion 9 de US-49).
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

export const BLOCKING_STATUSES: ReservationStatus[] = [
  RESERVATION_STATUS.pending_payment,
  RESERVATION_STATUS.confirmed,
  RESERVATION_STATUS.in_progress,
];

export const HOLD_TTL_MS = 10 * 60 * 1000;
export const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

export const CASCADE_REJECTION_REASON =
  'El vehículo fue reservado por otro conductor para fechas que se solapan.';
export const TRANSFER_TTL_MS = 2 * 60 * 60 * 1000;

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
  depositPercentageSnapshot?: number | null;
  basePriceCentsSnapshot?: number;
  cancellationPolicySnapshot?: CancellationPolicy;
  maxKilometrageSnapshot?: MaxKilometrage;
  rentalTimeConstraintsSnapshot?: RentalTimeConstraints;
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
  private readonly endAt: Date;
  private holdExpiresAt: Date | null;
  private readonly totalCents: number;
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
  private depositPercentageSnapshot: number | null;
  private basePriceCentsSnapshot: number;
  private cancellationPolicySnapshot: CancellationPolicy;
  private maxKilometrageSnapshot: MaxKilometrage;
  private rentalTimeConstraintsSnapshot: RentalTimeConstraints;
  private readonly createdAt: Date;
  private updatedAt: Date;

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
    this.depositPercentageSnapshot =
      props.depositPercentageSnapshot ?? RESERVATION_RULES_DEFAULTS.depositPercentage;
    this.basePriceCentsSnapshot = props.basePriceCentsSnapshot ?? 0;
    this.cancellationPolicySnapshot =
      props.cancellationPolicySnapshot ?? RESERVATION_RULES_DEFAULTS.cancellationPolicy;
    this.maxKilometrageSnapshot =
      props.maxKilometrageSnapshot ?? RESERVATION_RULES_DEFAULTS.maxKilometrage;
    this.rentalTimeConstraintsSnapshot =
      props.rentalTimeConstraintsSnapshot ?? RESERVATION_RULES_DEFAULTS.rentalTimeConstraints;
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
  public getDepositPercentageSnapshot(): number | null {
    return this.depositPercentageSnapshot;
  }
  public getBasePriceCentsSnapshot(): number {
    return this.basePriceCentsSnapshot;
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
   * al set o al precio del vehículo no afecten reservas confirmadas
   * (US-49 AC #2 y #3).
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
    this.basePriceCentsSnapshot = snapshot.basePriceCents;
    this.cancellationPolicySnapshot = snapshot.cancellationPolicy;
    this.maxKilometrageSnapshot = snapshot.maxKilometrage;
    this.rentalTimeConstraintsSnapshot = snapshot.rentalTimeConstraints;
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
    this.status = RESERVATION_STATUS.pending_approval;
    this.paymentMethod = 'bank_transfer';
    this.transferCode = transferCode;
    this.transferAlias = transferAlias;
    this.transferExpiresAt = new Date(now.getTime() + TRANSFER_TTL_MS);
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
    if (!this.isPendingPayment() && !this.isPendingApproval() && !this.isConfirmed()) {
      throw new InvalidReservationTransitionException(this.status, RESERVATION_STATUS.cancelled);
    }
    this.status = RESERVATION_STATUS.cancelled;
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
      depositPercentageSnapshot: this.depositPercentageSnapshot,
      basePriceCentsSnapshot: this.basePriceCentsSnapshot,
      cancellationPolicySnapshot: this.cancellationPolicySnapshot,
      maxKilometrageSnapshot: this.maxKilometrageSnapshot,
      rentalTimeConstraintsSnapshot: this.rentalTimeConstraintsSnapshot,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }
}
