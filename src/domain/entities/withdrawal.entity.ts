import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

export const WithdrawalStatusSchema = z.enum([
  'processing',
  'processed',
  'failed',
]);

const withdrawalSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  bankAccountId: z.string().uuid(),
  bankAccountAlias: z.string().trim().min(1),
  bankAccountMaskedCbu: z.string().trim().min(1),
  bankAccountProvider: z.string().trim().min(1),
  amountCents: z.number().int().positive(),
  currency: z.literal('ARS'),
  providerName: z.string().trim().min(1),
  providerTransactionId: z.string().trim().min(1),
  providerStatus: z.enum(['processed', 'processing', 'failed']),
  status: WithdrawalStatusSchema,
  providerMetadata: z.record(z.unknown()),
  balanceAfterCents: z.number().int().nonnegative(),
  createdAt: z.date(),
  processedAt: z.date().nullable(),
  updatedAt: z.date(),
});

export type WithdrawalStatus = z.infer<typeof WithdrawalStatusSchema>;

export interface WithdrawalProps {
  id?: string;
  userId: string;
  bankAccountId: string;
  bankAccountAlias: string;
  bankAccountMaskedCbu: string;
  bankAccountProvider: string;
  amountCents: number;
  currency?: 'ARS';
  providerName: string;
  providerTransactionId: string;
  providerStatus: 'processed' | 'processing' | 'failed';
  status?: WithdrawalStatus;
  providerMetadata: Record<string, unknown>;
  balanceAfterCents: number;
  createdAt?: Date;
  processedAt?: Date | null;
  updatedAt?: Date;
}

export class Withdrawal {
  constructor(private readonly props: WithdrawalProps) {
    this.props.id = props.id ?? randomUUID();
    this.props.currency = props.currency ?? 'ARS';
    this.props.status = props.status ?? 'processed';
    this.props.createdAt = props.createdAt ?? new Date();
    this.props.processedAt = props.processedAt ?? this.props.createdAt;
    this.props.updatedAt = props.updatedAt ?? this.props.createdAt;
    this.validate();
  }

  private validate(): void {
    const parsed = withdrawalSchema.safeParse(this.props);
    if (!parsed.success) {
      throw new InvalidEntityDataException(
        parsed.error.issues[0]?.message ?? 'withdrawal is invalid',
      );
    }
  }

  public getId(): string { return this.props.id!; }
  public getUserId(): string { return this.props.userId; }
  public getBankAccountId(): string { return this.props.bankAccountId; }
  public getBankAccountAlias(): string { return this.props.bankAccountAlias; }
  public getBankAccountMaskedCbu(): string { return this.props.bankAccountMaskedCbu; }
  public getBankAccountProvider(): string { return this.props.bankAccountProvider; }
  public getAmountCents(): number { return this.props.amountCents; }
  public getCurrency(): 'ARS' { return this.props.currency!; }
  public getProviderName(): string { return this.props.providerName; }
  public getProviderTransactionId(): string { return this.props.providerTransactionId; }
  public getProviderStatus(): 'processed' | 'processing' | 'failed' { return this.props.providerStatus; }
  public getStatus(): WithdrawalStatus { return this.props.status!; }
  public getProviderMetadata(): Record<string, unknown> { return this.props.providerMetadata; }
  public getBalanceAfterCents(): number { return this.props.balanceAfterCents; }
  public getCreatedAt(): Date { return this.props.createdAt!; }
  public getProcessedAt(): Date | null { return this.props.processedAt ?? null; }
  public getUpdatedAt(): Date { return this.props.updatedAt!; }
}