import { randomUUID } from 'node:crypto';

export interface PriceQuoteProps {
  id?: string;
  vehicleId: string;
  conductorId: string | null;
  startAt: Date;
  endAt: Date;
  basePriceCents: number;
  multiplier: number;
  discountPercentage: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: string;
  h3Cell: string;
  createdAt: Date;
  expiresAt: Date;
  levelDiscountPercentage?: number;
}

/**
 * Cotización congelada de una reserva potencial. Tiene un TTL corto (5 min) y
 * preserva el `multiplier` y descuento vigentes al momento del quote para que
 * el conductor pueda confirmar la reserva con el mismo precio que vio.
 */
export class PriceQuote {
  private readonly id: string;
  private readonly vehicleId: string;
  private readonly conductorId: string | null;
  private readonly startAt: Date;
  private readonly endAt: Date;
  private readonly basePriceCents: number;
  private readonly multiplier: number;
  private readonly discountPercentage: number;
  private readonly deliveryFeeCents: number;
  private readonly totalCents: number;
  private readonly currency: string;
  private readonly h3Cell: string;
  private readonly createdAt: Date;
  private readonly expiresAt: Date;
  private readonly levelDiscountPercentage: number | undefined;

  constructor(props: PriceQuoteProps) {
    this.id = props.id ?? randomUUID();
    this.vehicleId = props.vehicleId;
    this.conductorId = props.conductorId;
    this.startAt = props.startAt;
    this.endAt = props.endAt;
    this.basePriceCents = props.basePriceCents;
    this.multiplier = props.multiplier;
    this.discountPercentage = props.discountPercentage;
    this.deliveryFeeCents = props.deliveryFeeCents;
    this.totalCents = props.totalCents;
    this.currency = props.currency;
    this.h3Cell = props.h3Cell;
    this.createdAt = props.createdAt;
    this.expiresAt = props.expiresAt;
    this.levelDiscountPercentage = props.levelDiscountPercentage;
  }

  public getId(): string {
    return this.id;
  }
  public getVehicleId(): string {
    return this.vehicleId;
  }
  public getConductorId(): string | null {
    return this.conductorId;
  }
  public getStartAt(): Date {
    return this.startAt;
  }
  public getEndAt(): Date {
    return this.endAt;
  }
  public getBasePriceCents(): number {
    return this.basePriceCents;
  }
  public getMultiplier(): number {
    return this.multiplier;
  }
  public getDiscountPercentage(): number {
    return this.discountPercentage;
  }
  public getDeliveryFeeCents(): number {
    return this.deliveryFeeCents;
  }
  public getTotalCents(): number {
    return this.totalCents;
  }
  public getCurrency(): string {
    return this.currency;
  }
  public getH3Cell(): string {
    return this.h3Cell;
  }
  public getCreatedAt(): Date {
    return this.createdAt;
  }
  public getExpiresAt(): Date {
    return this.expiresAt;
  }
  public getLevelDiscountPercentage(): number | undefined {
    return this.levelDiscountPercentage;
  }

  public isExpired(now: Date): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  public matchesVehicle(vehicleId: string): boolean {
    return this.vehicleId === vehicleId;
  }

  /**
   * Verdadero si el quote es reutilizable por el conductor dado. Quotes
   * anónimos (sin conductor asociado) pueden ser usados por cualquier
   * conductor autenticado; quotes ya asociados a un conductor solo pueden
   * ser usados por ese mismo conductor.
   */
  public isUsableBy(conductorId: string): boolean {
    return this.conductorId === null || this.conductorId === conductorId;
  }
}
