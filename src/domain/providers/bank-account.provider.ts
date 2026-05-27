import type { BankAccountInput } from '@rocket-lease/contracts';

export interface BankAccountValidationResult {
  alias: string;
  cbu: string;
  provider: string;
  isVerified: boolean;
}

export interface BankAccountProvider {
  validateCbu(cbu: string): string;
  validateBankAccount(input: BankAccountInput): Promise<BankAccountValidationResult>;
}

export const BANK_ACCOUNT_PROVIDER = Symbol('BankAccountProvider');
