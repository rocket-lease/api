import { Inject, Injectable } from '@nestjs/common';
import {
  type WalletBalance,
  WalletBalanceSchema,
  type WalletTransactionsResponse,
  WalletTransactionsResponseSchema,
  type WithdrawRequest,
  WithdrawRequestSchema,
  type WithdrawResponse,
  WithdrawResponseSchema,
} from '@rocket-lease/contracts';
import { randomUUID } from 'node:crypto';
import { Reservation } from '@/domain/entities/reservation.entity';
import { EntityNotFoundException, BankAccountRequiredException } from '@/domain/exceptions/domain.exception';
import { InsufficientBalanceException, InvalidWithdrawAmountException } from '@/domain/exceptions/wallet.exception';
import { BANK_ACCOUNT_PROVIDER, type BankAccountProvider } from '@/domain/providers/bank-account.provider';
import { BANK_ACCOUNT_REPOSITORY, type BankAccountRepository } from '@/domain/repositories/bank-account.repository';
import { WALLET_REPOSITORY, type WalletRepository } from '@/domain/repositories/wallet.repository';

@Injectable()
export class WalletService {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
    @Inject(BANK_ACCOUNT_REPOSITORY)
    private readonly bankAccountRepository: BankAccountRepository,
    @Inject(BANK_ACCOUNT_PROVIDER)
    private readonly bankAccountProvider: BankAccountProvider,
  ) {}

  public async getBalance(userId: string): Promise<WalletBalance> {
    return WalletBalanceSchema.parse(await this.walletRepository.getBalance(userId));
  }

  public async getTransactions(userId: string): Promise<WalletTransactionsResponse> {
    const transactions = await this.walletRepository.findTransactionsByUserId(userId);
    return WalletTransactionsResponseSchema.parse({
      items: transactions.map((transaction) => ({
        id: transaction.getId(),
        userId: transaction.getUserId(),
        type: transaction.getType(),
        amountCents: transaction.getAmountCents(),
        currency: transaction.getCurrency(),
        reservationId: transaction.getReservationId(),
        withdrawalId: transaction.getWithdrawalId(),
        providerTransactionId: transaction.getProviderTransactionId(),
        bankAccountId: transaction.getBankAccountId(),
        bankAccountAlias: transaction.getBankAccountAlias(),
        bankAccountMaskedCbu: transaction.getBankAccountMaskedCbu(),
        providerStatus: transaction.getProviderStatus(),
        balanceAfterCents: transaction.getBalanceAfterCents(),
        createdAt: transaction.getCreatedAt().toISOString(),
      })),
    });
  }

  public async recordReservationPayout(reservation: Reservation): Promise<void> {
    await this.walletRepository.recordReservationPayout(reservation);
  }

  public async withdraw(userId: string, dto: WithdrawRequest): Promise<WithdrawResponse> {
    const parsed = WithdrawRequestSchema.parse(dto);
    if (parsed.amountCents <= 0) {
      throw new InvalidWithdrawAmountException();
    }

    const validBankAccounts = (await this.bankAccountRepository.findByOwnerId(userId)).filter(
      (account) => account.isActiveAccount() && account.isVerifiedAccount() && !account.isDeleted(),
    );
    if (validBankAccounts.length === 0) {
      throw new BankAccountRequiredException();
    }

    const bankAccount = validBankAccounts.find((account) => account.getId() === parsed.bankAccountId);
    if (!bankAccount) {
      throw new EntityNotFoundException('bank account', parsed.bankAccountId);
    }

    const balance = await this.walletRepository.getBalance(userId);
    if (balance.balanceCents < parsed.amountCents) {
      throw new InsufficientBalanceException();
    }

    const referenceId = randomUUID();
    const providerResult = await this.bankAccountProvider.transferToBankAccount({
      amountCents: parsed.amountCents,
      currency: 'ARS',
      userId,
      referenceId,
      bankAccountAlias: bankAccount.getAlias(),
      bankAccountCbu: bankAccount.getCbu(),
      bankAccountProvider: bankAccount.getProvider(),
    });

    const withdrawal = await this.walletRepository.recordWithdrawal({
      userId,
      bankAccount,
      amountCents: parsed.amountCents,
      currency: 'ARS',
      providerName: bankAccount.getProvider(),
      providerTransactionId: providerResult.providerTransactionId,
      providerStatus: providerResult.status,
      providerMetadata: providerResult.metadata,
      status: providerResult.status,
      referenceId,
      processedAt: providerResult.status === 'processed' ? new Date() : null,
      createdAt: new Date(),
    });

    return WithdrawResponseSchema.parse({
      id: withdrawal.getId(),
      userId: withdrawal.getUserId(),
      bankAccountId: withdrawal.getBankAccountId(),
      bankAccountAlias: withdrawal.getBankAccountAlias(),
      bankAccountMaskedCbu: withdrawal.getBankAccountMaskedCbu(),
      bankAccountProvider: withdrawal.getBankAccountProvider(),
      amountCents: withdrawal.getAmountCents(),
      currency: withdrawal.getCurrency(),
      providerName: withdrawal.getProviderName(),
      providerTransactionId: withdrawal.getProviderTransactionId(),
      providerStatus: withdrawal.getProviderStatus(),
      status: withdrawal.getStatus(),
      providerMetadata: withdrawal.getProviderMetadata(),
      balanceAfterCents: withdrawal.getBalanceAfterCents(),
      createdAt: withdrawal.getCreatedAt().toISOString(),
      processedAt: withdrawal.getProcessedAt()?.toISOString() ?? null,
    });
  }

  public async applyTicketResolution(userId: string, amountCents: number, ticketId: string): Promise<void> {
    await this.walletRepository.applyTicketResolution(userId, amountCents, ticketId);
  }
}