import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { InvalidEntityDataException } from '../exceptions/domain.exception';
import {
  ContractNotAcceptedException,
  InvalidReservationTransitionException,
  TransferExpiredException,
} from '../exceptions/reservation.exception';

const ReservationStatusEnum = z.enum([
  'pending_approval',
  'pending_payment',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
  'expired',
]);

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
  status: ReservationStatusEnum,
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
  rejectionReason: z.string().max(280).nullable(),
  transferExpiresAt: z.date().nullable(),
  transferCode: z.string().nullable(),
  transferAlias: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ReservationStatus = z.infer<typeof ReservationStatusEnum>;
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;
export type WalletProvider = z.infer<typeof WalletProviderEnum>;

export const BLOCKING_STATUSES: ReservationStatus[] = [
  'pending_payment',
  'confirmed',
  'in_progress',
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
  rejectionReason?: string | null;
  transferExpiresAt?: Date | null;
  transferCode?: string | null;
  transferAlias?: string | null;
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
  private rejectionReason: string | null;
  private transferExpiresAt: Date | null;
  private transferCode: string | null;
  private transferAlias: string | null;
  private readonly createdAt: Date;
  private updatedAt: Date;

  constructor(props: ReservationProps) {
    this.id = props.id ?? randomUUID();
    this.vehicleId = props.vehicleId;
    this.conductorId = props.conductorId;
    this.rentadorId = props.rentadorId;
    this.status = props.status ?? 'pending_payment';
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
    this.rejectionReason = props.rejectionReason ?? null;
    this.transferExpiresAt = props.transferExpiresAt ?? null;
    this.transferCode = props.transferCode ?? null;
    this.transferAlias = props.transferAlias ?? null;
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
  public getCreatedAt() {
    return this.createdAt;
  }
  public getUpdatedAt() {
    return this.updatedAt;
  }

  public isOwnedByConductor(conductorId: string): boolean {
    return this.conductorId === conductorId;
  }

  public isOwnedByRentador(rentadorId: string): boolean {
    return this.rentadorId === rentadorId;
  }

  public isHoldExpired(now: Date): boolean {
    if (this.status !== 'pending_payment' && this.status !== 'pending_approval') return false;
    if (!this.holdExpiresAt) return false;
    return this.holdExpiresAt.getTime() <= now.getTime();
  }

  public isTransferExpired(now: Date): boolean {
    if (this.status !== 'pending_approval') return false;
    if (!this.transferExpiresAt) return false;
    return this.transferExpiresAt.getTime() <= now.getTime();
  }

  /**
   * Confirma el pago inmediato (tarjeta crédito, débito, billetera virtual).
   * Transita de pending_payment → confirmed.
   */
  public confirmPayment(
    method: PaymentMethod,
    now: Date,
    walletProvider?: WalletProvider,
  ): void {
    if (this.status !== 'pending_payment' && this.status !== 'pending_approval') {
      throw new InvalidReservationTransitionException(this.status, 'confirmed');
    }
    if (!this.contractAcceptedAt) {
      throw new ContractNotAcceptedException();
    }
    if (method === 'digital_wallet' && !walletProvider) {
      throw new InvalidEntityDataException(
        'walletProvider is required for digital_wallet',
      );
    }
    this.status = 'confirmed';
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
    if (this.status !== 'pending_payment' && this.status !== 'pending_approval') {
      throw new InvalidReservationTransitionException(
        this.status,
        'pending_approval',
      );
    }
    if (!this.contractAcceptedAt) {
      throw new ContractNotAcceptedException();
    }
    this.status = 'pending_approval';
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
    if (this.status !== 'pending_approval') {
      throw new InvalidReservationTransitionException(
        this.status,
        'confirmed',
      );
    }
    if (this.isTransferExpired(now)) {
      throw new TransferExpiredException(this.id);
    }
    this.status = 'confirmed';
    this.paidAt = now;
    this.transferExpiresAt = null;
    this.updatedAt = now;
  }

  /**
   * Expira una transferencia no acreditada.
   * Transita de pending_approval → cancelled.
   */
  public expireTransfer(now: Date): void {
    if (this.status !== 'pending_approval') {
      throw new InvalidReservationTransitionException(this.status, 'cancelled');
    }
    this.status = 'cancelled';
    this.transferExpiresAt = null;
    this.updatedAt = now;
  }

  public markExpired(now: Date): void {
    if (this.status !== 'pending_payment') {
      throw new InvalidReservationTransitionException(this.status, 'expired');
    }
    this.status = 'expired';
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
    if (this.status !== 'pending_approval') {
      throw new InvalidReservationTransitionException(
        this.status,
        'pending_payment',
      );
    }
    this.status = 'pending_payment';
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
    if (this.status !== 'pending_approval') {
      throw new InvalidReservationTransitionException(this.status, 'rejected');
    }
    this.status = 'rejected';
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
    if (this.status !== 'pending_approval') {
      throw new InvalidReservationTransitionException(this.status, 'expired');
    }
    this.status = 'expired';
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
      this.status !== 'pending_payment' &&
      this.status !== 'pending_approval'
    ) {
      throw new InvalidReservationTransitionException(this.status, 'cancelled');
    }
    this.status = 'cancelled';
    this.holdExpiresAt = null;
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
      rejectionReason: this.rejectionReason,
      transferExpiresAt: this.transferExpiresAt,
      transferCode: this.transferCode,
      transferAlias: this.transferAlias,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }
}
