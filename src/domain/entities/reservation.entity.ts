import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { InvalidEntityDataException } from '../exceptions/domain.exception';
import {
  ContractNotAcceptedException,
  InvalidReservationTransitionException,
} from '../exceptions/reservation.exception';

const ReservationStatusEnum = z.enum([
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
]);

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
  contractAcceptedAt: z.date().nullable(),
  paidAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ReservationStatus = z.infer<typeof ReservationStatusEnum>;
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const BLOCKING_STATUSES: ReservationStatus[] = [
  'pending_payment',
  'confirmed',
  'in_progress',
];

export const HOLD_TTL_MS = 10 * 60 * 1000;

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
  contractAcceptedAt: Date | null;
  paidAt?: Date | null;
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
  private contractAcceptedAt: Date | null;
  private paidAt: Date | null;
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
    this.contractAcceptedAt = props.contractAcceptedAt;
    this.paidAt = props.paidAt ?? null;
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
  public getContractAcceptedAt() {
    return this.contractAcceptedAt;
  }
  public getPaidAt() {
    return this.paidAt;
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

  public isHoldExpired(now: Date): boolean {
    if (this.status !== 'pending_payment') return false;
    if (!this.holdExpiresAt) return false;
    return this.holdExpiresAt.getTime() <= now.getTime();
  }

  public confirmPayment(method: PaymentMethod, now: Date): void {
    if (this.status !== 'pending_payment') {
      throw new InvalidReservationTransitionException(this.status, 'confirmed');
    }
    if (!this.contractAcceptedAt) {
      throw new ContractNotAcceptedException();
    }
    this.status = 'confirmed';
    this.paymentMethod = method;
    this.paidAt = now;
    this.holdExpiresAt = null;
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

  public cancelHold(now: Date): void {
    if (this.status !== 'pending_payment') {
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
      contractAcceptedAt: this.contractAcceptedAt,
      paidAt: this.paidAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }
}
