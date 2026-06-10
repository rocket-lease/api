import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

export const WalletTransactionTypeSchema = z.enum([
  'reservation_credit',
  'withdrawal_debit',
  'dispute_penalty_debit',
  'dispute_penalty_credit',
]);

const walletTransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: WalletTransactionTypeSchema,
  amountCents: z.number().int().positive(),
  currency: z.literal('ARS'),
  reservationId: z.string().uuid().nullable(),
  withdrawalId: z.string().uuid().nullable(),
  providerTransactionId: z.string().nullable(),
  bankAccountId: z.string().uuid().nullable(),
  bankAccountAlias: z.string().nullable(),
  bankAccountMaskedCbu: z.string().nullable(),
  providerStatus: z.enum(['processed', 'processing', 'failed']).nullable(),
  balanceAfterCents: z.number().int().nonnegative(),
  createdAt: z.date(),
});

export type WalletTransactionType = z.infer<typeof WalletTransactionTypeSchema>;

export interface WalletTransactionProps {
  id?: string;
  userId: string;
  type: WalletTransactionType;
  amountCents: number;
  currency?: 'ARS';
  reservationId?: string | null;
  withdrawalId?: string | null;
  providerTransactionId?: string | null;
  bankAccountId?: string | null;
  bankAccountAlias?: string | null;
  bankAccountMaskedCbu?: string | null;
  providerStatus?: 'processed' | 'processing' | 'failed' | null;
  balanceAfterCents: number;
  createdAt?: Date;
}

export class WalletTransaction {
  constructor(private readonly props: WalletTransactionProps) {
    this.props.id = props.id ?? randomUUID();
    this.props.currency = props.currency ?? 'ARS';
    this.props.reservationId = props.reservationId ?? null;
    this.props.withdrawalId = props.withdrawalId ?? null;
    this.props.providerTransactionId = props.providerTransactionId ?? null;
    this.props.bankAccountId = props.bankAccountId ?? null;
    this.props.bankAccountAlias = props.bankAccountAlias ?? null;
    this.props.bankAccountMaskedCbu = props.bankAccountMaskedCbu ?? null;
    this.props.providerStatus = props.providerStatus ?? null;
    this.props.createdAt = props.createdAt ?? new Date();
    this.validate();
  }

  private validate(): void {
    const parsed = walletTransactionSchema.safeParse(this.props);
    if (!parsed.success) {
      throw new InvalidEntityDataException(
        parsed.error.issues[0]?.message ?? 'wallet transaction is invalid',
      );
    }
  }

  public getId(): string { return this.props.id!; }
  public getUserId(): string { return this.props.userId; }
  public getType(): WalletTransactionType { return this.props.type; }
  public getAmountCents(): number { return this.props.amountCents; }
  public getCurrency(): 'ARS' { return this.props.currency!; }
  public getReservationId(): string | null { return this.props.reservationId ?? null; }
  public getWithdrawalId(): string | null { return this.props.withdrawalId ?? null; }
  public getProviderTransactionId(): string | null { return this.props.providerTransactionId ?? null; }
  public getBankAccountId(): string | null { return this.props.bankAccountId ?? null; }
  public getBankAccountAlias(): string | null { return this.props.bankAccountAlias ?? null; }
  public getBankAccountMaskedCbu(): string | null { return this.props.bankAccountMaskedCbu ?? null; }
  public getProviderStatus(): 'processed' | 'processing' | 'failed' | null { return this.props.providerStatus ?? null; }
  public getBalanceAfterCents(): number { return this.props.balanceAfterCents; }
  public getCreatedAt(): Date { return this.props.createdAt!; }
}