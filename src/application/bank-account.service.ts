import { Inject, Injectable } from '@nestjs/common';
import {
  BankAccountListResponse,
  BankAccountListResponseSchema,
  CreateBankAccountRequest,
  CreateBankAccountRequestSchema,
  CreateBankAccountResponse,
  CreateBankAccountResponseSchema,
} from '@rocket-lease/contracts';
import { randomUUID } from 'crypto';
import { BankAccount } from '@/domain/entities/bank-account.entity';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import { BANK_ACCOUNT_PROVIDER, type BankAccountProvider } from '@/domain/providers/bank-account.provider';
import { BANK_ACCOUNT_REPOSITORY, type BankAccountRepository } from '@/domain/repositories/bank-account.repository';

function maskCbu(cbu: string): string {
  return `${cbu.slice(0, 4)}${'*'.repeat(14)}${cbu.slice(-4)}`;
}

@Injectable()
export class BankAccountService {
  constructor(
    @Inject(BANK_ACCOUNT_REPOSITORY)
    private readonly bankAccountRepository: BankAccountRepository,
    @Inject(BANK_ACCOUNT_PROVIDER)
    private readonly bankAccountProvider: BankAccountProvider,
  ) {}

  public async listMine(ownerId: string): Promise<BankAccountListResponse> {
    const bankAccounts = await this.bankAccountRepository.findByOwnerId(ownerId);
    return BankAccountListResponseSchema.parse(bankAccounts.map((account) => this.toResponse(account)));
  }

  public async createBankAccount(
    ownerId: string,
    dto: CreateBankAccountRequest,
  ): Promise<CreateBankAccountResponse> {
    const parsed = CreateBankAccountRequestSchema.parse(dto);
    const validated = await this.bankAccountProvider.validateBankAccount(parsed);
    const bankAccount = new BankAccount(
      randomUUID(),
      ownerId,
      validated.provider,
      validated.alias,
      validated.cbu,
      true,
      validated.isVerified,
    );
    const saved = await this.bankAccountRepository.save(bankAccount);
    return CreateBankAccountResponseSchema.parse(this.toResponse(saved));
  }

  public async deleteBankAccount(ownerId: string, bankAccountId: string): Promise<void> {
    const existing = await this.bankAccountRepository.findById(bankAccountId);
    if (!existing || existing.getOwnerId() !== ownerId || existing.isDeleted()) {
      throw new EntityNotFoundException('bank account', bankAccountId);
    }
    await this.bankAccountRepository.delete(bankAccountId);
  }

  public async hasPublishableBankAccount(ownerId: string): Promise<boolean> {
    const bankAccounts = await this.bankAccountRepository.findByOwnerId(ownerId);
    return bankAccounts.some((account) => account.isActiveAccount() && account.isVerifiedAccount() && !account.isDeleted());
  }

  private toResponse(account: BankAccount) {
    return {
      id: account.getId(),
      ownerId: account.getOwnerId(),
      provider: account.getProvider(),
      alias: account.getAlias(),
      cbu: account.getCbu(),
      maskedCbu: maskCbu(account.getCbu()),
      isActive: account.isActiveAccount(),
      isVerified: account.isVerifiedAccount(),
      deletedAt: account.getDeletedAt()?.toISOString() ?? null,
      createdAt: account.getCreatedAt().toISOString(),
      updatedAt: account.getUpdatedAt().toISOString(),
    };
  }
}