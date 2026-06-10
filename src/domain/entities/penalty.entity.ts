import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const penaltySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['conductor', 'rentador']),
  ticketId: z.string().uuid(),
  reason: z.string().min(10).max(500),
  scoreDeduction: z.number().min(0.1).max(5.0),
  appliedAt: z.date(),
});

export type PenaltyRole = 'conductor' | 'rentador';

export interface PenaltyProps {
  id?: string;
  userId: string;
  role: PenaltyRole;
  ticketId: string;
  reason: string;
  scoreDeduction: number;
  appliedAt?: Date;
}

export class Penalty {
  private readonly id: string;
  private readonly userId: string;
  private readonly role: PenaltyRole;
  private readonly ticketId: string;
  private readonly reason: string;
  private readonly scoreDeduction: number;
  private readonly appliedAt: Date;

  constructor(props: PenaltyProps) {
    this.id = props.id ?? randomUUID();
    this.userId = props.userId;
    this.role = props.role;
    this.ticketId = props.ticketId;
    this.reason = props.reason;
    this.scoreDeduction = props.scoreDeduction;
    this.appliedAt = props.appliedAt ?? new Date();
    this.validate();
  }

  public getId(): string {
    return this.id;
  }

  public getUserId(): string {
    return this.userId;
  }

  public getRole(): PenaltyRole {
    return this.role;
  }

  public getTicketId(): string {
    return this.ticketId;
  }

  public getReason(): string {
    return this.reason;
  }

  public getScoreDeduction(): number {
    return this.scoreDeduction;
  }

  public getAppliedAt(): Date {
    return this.appliedAt;
  }

  private validate(): void {
    const result = penaltySchema.safeParse({
      id: this.id,
      userId: this.userId,
      role: this.role,
      ticketId: this.ticketId,
      reason: this.reason,
      scoreDeduction: this.scoreDeduction,
      appliedAt: this.appliedAt,
    });
    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }
}
