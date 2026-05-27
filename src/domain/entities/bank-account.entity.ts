import { z } from 'zod';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const bankAccountSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  provider: z.string().trim().min(1).max(50),
  alias: z.string().trim().min(3).max(50),
  cbu: z.string().trim().regex(/^\d{22}$/),
  isActive: z.boolean(),
  isVerified: z.boolean(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class BankAccount {
  constructor(
    private readonly id: string,
    private readonly ownerId: string,
    private provider: string,
    private alias: string,
    private cbu: string,
    private isActive: boolean = true,
    private isVerified: boolean = true,
    private deletedAt: Date | null = null,
    private readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date(),
  ) {
    this.validate();
  }

  private validate(): void {
    const parsed = bankAccountSchema.safeParse({
      id: this.id,
      ownerId: this.ownerId,
      provider: this.provider,
      alias: this.alias,
      cbu: this.cbu,
      isActive: this.isActive,
      isVerified: this.isVerified,
      deletedAt: this.deletedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
    if (!parsed.success) {
      throw new InvalidEntityDataException(parsed.error.issues[0]?.message ?? 'bank account is invalid');
    }
  }

  public getId(): string { return this.id; }
  public getOwnerId(): string { return this.ownerId; }
  public getProvider(): string { return this.provider; }
  public getAlias(): string { return this.alias; }
  public getCbu(): string { return this.cbu; }
  public isActiveAccount(): boolean { return this.isActive; }
  public isVerifiedAccount(): boolean { return this.isVerified; }
  public getDeletedAt(): Date | null { return this.deletedAt; }
  public getCreatedAt(): Date { return this.createdAt; }
  public getUpdatedAt(): Date { return this.updatedAt; }

  public isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  public update(data: { provider: string; alias: string; cbu: string; isVerified?: boolean }): void {
    this.provider = data.provider;
    this.alias = data.alias;
    this.cbu = data.cbu;
    this.isVerified = data.isVerified ?? this.isVerified;
    this.updatedAt = new Date();
    this.validate();
  }

  public deactivate(): void {
    this.isActive = false;
    this.deletedAt = new Date();
    this.updatedAt = new Date();
    this.validate();
  }
}