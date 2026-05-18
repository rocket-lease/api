import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  ReservationRuleSetSchema,
  type CancellationPolicy,
  type Deposit,
  type MaxKilometrage,
  type RentalTimeConstraints,
} from '@rocket-lease/contracts';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const reservationRuleSetEntitySchema = ReservationRuleSetSchema.extend({
  vehicleCount: z.number().nonnegative().default(0),
});

export class ReservationRuleSet {
  constructor(
    private readonly rentalorId: string,
    private name: string,
    private description: string | null,
    private cancellationPolicy: CancellationPolicy,
    private deposit: Deposit,
    private maxKilometrage: MaxKilometrage,
    private rentalTimeConstraints: RentalTimeConstraints,
    private vehicleCount: number = 0,
    private readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date(),
    private readonly id: string = randomUUID(),
  ) {
    this.validate();
  }

  public getId(): string {
    return this.id;
  }

  public getRentalorId(): string {
    return this.rentalorId;
  }

  public getName(): string {
    return this.name;
  }

  public getDescription(): string | null {
    return this.description;
  }

  public getCancellationPolicy(): CancellationPolicy {
    return this.cancellationPolicy;
  }

  public getDeposit(): Deposit {
    return this.deposit;
  }

  public getMaxKilometrage(): MaxKilometrage {
    return this.maxKilometrage;
  }

  public getRentalTimeConstraints(): RentalTimeConstraints {
    return this.rentalTimeConstraints;
  }

  public getVehicleCount(): number {
    return this.vehicleCount;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }

  public update(data: {
    name?: string;
    description?: string | null;
    cancellationPolicy?: CancellationPolicy;
    deposit?: Deposit;
    maxKilometrage?: MaxKilometrage;
    rentalTimeConstraints?: RentalTimeConstraints;
  }): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.cancellationPolicy !== undefined) {
      this.cancellationPolicy = data.cancellationPolicy;
    }
    if (data.deposit !== undefined) this.deposit = data.deposit;
    if (data.maxKilometrage !== undefined) this.maxKilometrage = data.maxKilometrage;
    if (data.rentalTimeConstraints !== undefined) {
      this.rentalTimeConstraints = data.rentalTimeConstraints;
    }
    this.updatedAt = new Date();
    this.validate();
  }

  public withVehicleCount(vehicleCount: number): ReservationRuleSet {
    return new ReservationRuleSet(
      this.rentalorId,
      this.name,
      this.description,
      this.cancellationPolicy,
      this.deposit,
      this.maxKilometrage,
      this.rentalTimeConstraints,
      vehicleCount,
      this.createdAt,
      this.updatedAt,
      this.id,
    );
  }

  private validate(): void {
    const result = reservationRuleSetEntitySchema.safeParse({
      id: this.id,
      rentalorId: this.rentalorId,
      name: this.name,
      description: this.description,
      cancellationPolicy: this.cancellationPolicy,
      deposit: this.deposit,
      maxKilometrage: this.maxKilometrage,
      rentalTimeConstraints: this.rentalTimeConstraints,
      vehicleCount: this.vehicleCount,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    });

    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }
}