import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { InvalidEntityDataException } from '../exceptions/domain.exception';
import {
  getLevelDef,
  getNextLevelDef,
  getBenefitsForLevel,
} from '@/application/loyalty-config';

const loyaltyProfileSchema = z.object({
  id: z.string().uuid(),
  conductorId: z.string().uuid(),
  level: z.enum(['bronze', 'silver', 'gold', 'platinum']),
  totalXp: z.number().int().nonnegative(),
  pendingXp: z.number().int().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type LoyaltyProfileLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyProfileProps {
  id?: string;
  conductorId: string;
  level?: string;
  totalXp?: number;
  pendingXp?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProfileView {
  conductorId: string;
  level: string;
  totalXp: number;
  pendingXp: number;
  xpForNextLevel: number | null;
  progress: number | null;
  benefits: { type: string; description: string; config: Record<string, unknown> | null }[];
}

export class LoyaltyProfile {
  private readonly id: string;
  private readonly conductorId: string;
  private level: string;
  private totalXp: number;
  private pendingXp: number;
  private readonly createdAt: Date;
  private updatedAt: Date;

  constructor(props: LoyaltyProfileProps) {
    this.id = props.id ?? randomUUID();
    this.conductorId = props.conductorId;
    this.level = props.level ?? 'bronze';
    this.totalXp = props.totalXp ?? 0;
    this.pendingXp = props.pendingXp ?? 0;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.validate();
  }

  public getId(): string { return this.id; }
  public getConductorId(): string { return this.conductorId; }
  public getLevel(): string { return this.level; }
  public getTotalXp(): number { return this.totalXp; }
  public getPendingXp(): number { return this.pendingXp; }
  public getCreatedAt(): Date { return this.createdAt; }
  public getUpdatedAt(): Date { return this.updatedAt; }

  public addPendingXp(amount: number): void {
    this.pendingXp += amount;
  }

  public claimPendingXp(amount: number): void {
    if (amount > this.pendingXp) {
      throw new InvalidEntityDataException('Not enough pending XP to claim');
    }
    this.pendingXp -= amount;
    this.totalXp += amount;
  }

  public setLevel(newLevel: string): void {
    this.level = newLevel;
  }

  public toProfile(): ProfileView {
    const currentDef = getLevelDef(this.level);
    const nextDef = getNextLevelDef(this.level);
    const xpForNextLevel = nextDef ? nextDef.minXp - this.totalXp : null;
    const progress = nextDef
      ? Math.min(100, Math.floor(((this.totalXp - (currentDef?.minXp ?? 0)) / (nextDef.minXp - (currentDef?.minXp ?? 0))) * 100))
      : 100;
    const benefits = getBenefitsForLevel(this.level);

    return {
      conductorId: this.conductorId,
      level: this.level,
      totalXp: this.totalXp,
      pendingXp: this.pendingXp,
      xpForNextLevel: xpForNextLevel !== null && xpForNextLevel < 0 ? 0 : xpForNextLevel,
      progress: xpForNextLevel !== null ? Math.max(0, Math.min(100, progress)) : 100,
      benefits,
    };
  }

  private validate(): void {
    const result = loyaltyProfileSchema.safeParse({
      id: this.id,
      conductorId: this.conductorId,
      level: this.level,
      totalXp: this.totalXp,
      pendingXp: this.pendingXp,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }
}
