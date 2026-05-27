import { Injectable } from '@nestjs/common';
import { BankAccount } from '@/domain/entities/bank-account.entity';
import type { BankAccountRepository } from '@/domain/repositories/bank-account.repository';

@Injectable()
export class InMemoryBankAccountRepository implements BankAccountRepository {
  private readonly storage = new Map<string, BankAccount>();

  async save(bankAccount: BankAccount): Promise<BankAccount> {
    if (!bankAccount.getId()) {
      throw new Error('bank account id is required');
    }
    this.storage.set(bankAccount.getId(), bankAccount);
    return bankAccount;
  }

  async delete(id: string): Promise<void> {
    const bankAccount = this.storage.get(id);
    if (!bankAccount) {
      return;
    }
    bankAccount.deactivate();
    this.storage.set(id, bankAccount);
  }

  async findById(id: string): Promise<BankAccount | null> {
    return this.storage.get(id) ?? null;
  }

  async findByOwnerId(ownerId: string): Promise<BankAccount[]> {
    return Array.from(this.storage.values()).filter((account) => account.getOwnerId() === ownerId && !account.isDeleted());
  }

  clear(): void {
    this.storage.clear();
  }
}