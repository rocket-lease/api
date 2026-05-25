import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  ReservationRuleSetSchema,
  type CancellationPolicy,
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
    private readonly vehicleId: string | null,
    private name: string,
    private description: string | null,
    private cancellationPolicy: CancellationPolicy,
    private depositPercentage: number | null,
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

  public getVehicleId(): string | null {
    return this.vehicleId;
  }

  /**
   * Un set es "privado" cuando está atado a un vehículo específico
   * (vehicleId != null). Estos sets no aparecen al listar los sets compartidos
   * del rentador en "Perfil → Sets de reglas".
   */
  public isPrivate(): boolean {
    return this.vehicleId !== null;
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

  public getDepositPercentage(): number | null {
    return this.depositPercentage;
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
    depositPercentage?: number | null;
    maxKilometrage?: MaxKilometrage;
    rentalTimeConstraints?: RentalTimeConstraints;
  }): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.cancellationPolicy !== undefined) {
      this.cancellationPolicy = data.cancellationPolicy;
    }
    if (data.depositPercentage !== undefined) {
      this.depositPercentage = data.depositPercentage;
    }
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
      this.vehicleId,
      this.name,
      this.description,
      this.cancellationPolicy,
      this.depositPercentage,
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
      vehicleId: this.vehicleId,
      name: this.name,
      description: this.description ?? undefined,
      cancellationPolicy: this.cancellationPolicy,
      depositPercentage: this.depositPercentage,
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
