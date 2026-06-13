import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const transactionSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  amount: z.number().int().nonnegative(),
  reservationId: z.string().uuid(),
  reservationVehicleName: z.string().min(1),
  reservationVehicleId: z.string().uuid(),
  reservationStartAt: z.date(),
  reservationEndAt: z.date(),
  status: z.enum(['pending', 'claimed']),
  createdAt: z.date(),
});

export interface ReservationSnapshot {
  id: string;
  vehicleName: string;
  vehicleId: string;
  startAt: Date;
  endAt: Date;
}

export interface ExperienceTransactionProps {
  id?: string;
  profileId: string;
  amount: number;
  reservationId: string;
  reservationVehicleName: string;
  reservationVehicleId: string;
  reservationStartAt: Date;
  reservationEndAt: Date;
  status?: string;
  createdAt?: Date;
}

export class ExperienceTransaction {
  private readonly id: string;
  private readonly profileId: string;
  private readonly amount: number;
  private readonly reservationId: string;
  private readonly reservationVehicleName: string;
  private readonly reservationVehicleId: string;
  private readonly reservationStartAt: Date;
  private readonly reservationEndAt: Date;
  private status: string;
  private readonly createdAt: Date;

  constructor(props: ExperienceTransactionProps) {
    this.id = props.id ?? randomUUID();
    this.profileId = props.profileId;
    this.amount = props.amount;
    this.reservationId = props.reservationId;
    this.reservationVehicleName = props.reservationVehicleName;
    this.reservationVehicleId = props.reservationVehicleId;
    this.reservationStartAt = props.reservationStartAt;
    this.reservationEndAt = props.reservationEndAt;
    this.status = props.status ?? 'pending';
    this.createdAt = props.createdAt ?? new Date();
    this.validate();
  }

  public getId(): string { return this.id; }
  public getProfileId(): string { return this.profileId; }
  public getAmount(): number { return this.amount; }
  public getReservationId(): string { return this.reservationId; }
  public getReservationVehicleName(): string { return this.reservationVehicleName; }
  public getReservationVehicleId(): string { return this.reservationVehicleId; }
  public getReservationStartAt(): Date { return this.reservationStartAt; }
  public getReservationEndAt(): Date { return this.reservationEndAt; }
  public getStatus(): string { return this.status; }
  public getCreatedAt(): Date { return this.createdAt; }

  public getReservationSnapshot(): ReservationSnapshot {
    return {
      id: this.reservationId,
      vehicleName: this.reservationVehicleName,
      vehicleId: this.reservationVehicleId,
      startAt: this.reservationStartAt,
      endAt: this.reservationEndAt,
    };
  }

  public claim(): void {
    this.status = 'claimed';
  }

  private validate(): void {
    const result = transactionSchema.safeParse({
      id: this.id,
      profileId: this.profileId,
      amount: this.amount,
      reservationId: this.reservationId,
      reservationVehicleName: this.reservationVehicleName,
      reservationVehicleId: this.reservationVehicleId,
      reservationStartAt: this.reservationStartAt,
      reservationEndAt: this.reservationEndAt,
      status: this.status,
      createdAt: this.createdAt,
    });
    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }
}
