import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Reservation } from '@/domain/entities/reservation.entity';
import { WalletTransaction } from '@/domain/entities/wallet-transaction.entity';
import { Withdrawal } from '@/domain/entities/withdrawal.entity';
import type { WalletBalanceSnapshot, WalletRepository, RecordWithdrawalInput } from '@/domain/repositories/wallet.repository';

@Injectable()
export class InMemoryWalletRepository implements WalletRepository {
  private readonly balances = new Map<string, number>();
  private readonly transactions = new Map<string, WalletTransaction[]>();
  private readonly withdrawals = new Map<string, Withdrawal>();

  async getBalance(userId: string): Promise<WalletBalanceSnapshot> {
    return { balanceCents: this.balances.get(userId) ?? 0, currency: 'ARS' };
  }

  async findTransactionsByUserId(userId: string): Promise<WalletTransaction[]> {
    return [...(this.transactions.get(userId) ?? [])];
  }

  async recordReservationPayout(reservation: Reservation): Promise<void> {
    const balance = this.balances.get(reservation.getRentadorId()) ?? 0;
    const nextBalance = balance + reservation.getTotalCents();
    this.balances.set(reservation.getRentadorId(), nextBalance);
    const movement = new WalletTransaction({
      id: randomUUID(),
      userId: reservation.getRentadorId(),
      type: 'reservation_credit',
      amountCents: reservation.getTotalCents(),
      reservationId: reservation.getId(),
      balanceAfterCents: nextBalance,
      createdAt: reservation.getCompletedAt() ?? new Date(),
    });
    this.transactions.set(reservation.getRentadorId(), [movement, ...(this.transactions.get(reservation.getRentadorId()) ?? [])]);
  }

  async recordWithdrawal(input: RecordWithdrawalInput): Promise<Withdrawal> {
    const balance = this.balances.get(input.userId) ?? 0;
    const nextBalance = balance - input.amountCents;
    this.balances.set(input.userId, nextBalance);
    const withdrawal = new Withdrawal({
      id: input.referenceId,
      userId: input.userId,
      bankAccountId: input.bankAccount.getId(),
      bankAccountAlias: input.bankAccount.getAlias(),
      bankAccountMaskedCbu: `${input.bankAccount.getCbu().slice(0, 4)}${'*'.repeat(14)}${input.bankAccount.getCbu().slice(-4)}`,
      bankAccountProvider: input.bankAccount.getProvider(),
      amountCents: input.amountCents,
      providerName: input.providerName,
      providerTransactionId: input.providerTransactionId,
      providerStatus: input.providerStatus,
      status: input.status,
      providerMetadata: input.providerMetadata,
      balanceAfterCents: nextBalance,
      createdAt: input.createdAt,
      processedAt: input.processedAt,
    });
    this.withdrawals.set(withdrawal.getId(), withdrawal);
    this.transactions.set(input.userId, [
      new WalletTransaction({
        userId: input.userId,
        type: 'withdrawal_debit',
        amountCents: input.amountCents,
        withdrawalId: withdrawal.getId(),
        providerTransactionId: input.providerTransactionId,
        bankAccountId: input.bankAccount.getId(),
        bankAccountAlias: input.bankAccount.getAlias(),
        bankAccountMaskedCbu: `${input.bankAccount.getCbu().slice(0, 4)}${'*'.repeat(14)}${input.bankAccount.getCbu().slice(-4)}`,
        providerStatus: input.providerStatus,
        balanceAfterCents: nextBalance,
        createdAt: input.createdAt,
      }),
      ...(this.transactions.get(input.userId) ?? []),
    ]);
    return withdrawal;
  }
}