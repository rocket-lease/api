import { Injectable } from '@nestjs/common';
import {
  BankAccountCbuSchema,
  type BankAccountInput,
} from '@rocket-lease/contracts';
import type {
  BankAccountProvider,
  BankAccountValidationResult,
  BankAccountTransferInput,
  BankAccountTransferResult,
} from '@/domain/providers/bank-account.provider';

@Injectable()
export class StubBankAccountProvider implements BankAccountProvider {

  validateCbu(cbu: string): string {
    return BankAccountCbuSchema.parse(cbu);
  }

  async validateBankAccount(input: BankAccountInput): Promise<BankAccountValidationResult> {
    const cbu = this.validateCbu(input.cbu);
    return {
      alias: input.alias.trim(),
      cbu,
      provider: 'stub-bank-provider',
      isVerified: true,
    };
  }

  async transferToBankAccount(
    input: BankAccountTransferInput,
  ): Promise<BankAccountTransferResult> {
    const providerTransactionId = `payout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      providerTransactionId,
      status: 'processed',
      metadata: {
        stub: true,
        referenceId: input.referenceId,
        userId: input.userId,
        amountCents: input.amountCents,
        currency: input.currency,
        bankAccountAlias: input.bankAccountAlias,
        bankAccountProvider: input.bankAccountProvider,
      },
    };
  }
}