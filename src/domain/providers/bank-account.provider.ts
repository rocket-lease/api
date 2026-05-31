import type { BankAccountInput } from '@rocket-lease/contracts';

export interface BankAccountValidationResult {
  alias: string;
  cbu: string;
  provider: string;
  isVerified: boolean;
}

export interface BankAccountTransferInput {
  amountCents: number;
  currency: 'ARS';
  userId: string;
  referenceId: string;
  bankAccountAlias: string;
  bankAccountCbu: string;
  bankAccountProvider: string;
}

export interface BankAccountTransferResult {
  providerTransactionId: string;
  status: 'processed' | 'processing' | 'failed';
  metadata: Record<string, unknown>;
}

export interface BankAccountProvider {
  validateCbu(cbu: string): string;
  validateBankAccount(input: BankAccountInput): Promise<BankAccountValidationResult>;
  transferToBankAccount(input: BankAccountTransferInput): Promise<BankAccountTransferResult>;
}

export const BANK_ACCOUNT_PROVIDER = Symbol('BankAccountProvider');
