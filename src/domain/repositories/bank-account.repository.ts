import { BankAccount } from '../entities/bank-account.entity';

export interface BankAccountRepository {
  save(bankAccount: BankAccount): Promise<BankAccount>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<BankAccount | null>;
  findByOwnerId(ownerId: string): Promise<BankAccount[]>;
}

export const BANK_ACCOUNT_REPOSITORY = Symbol('BankAccountRepository');