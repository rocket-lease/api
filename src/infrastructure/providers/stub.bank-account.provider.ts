import { Injectable } from '@nestjs/common';
import {
  BankAccountCbuSchema,
  type BankAccountInput,
} from '@rocket-lease/contracts';
import type {
  BankAccountProvider,
  BankAccountValidationResult,
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
}