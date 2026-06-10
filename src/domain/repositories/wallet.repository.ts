import type { Reservation } from '../entities/reservation.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { Withdrawal } from '../entities/withdrawal.entity';
import type { BankAccount } from '../entities/bank-account.entity';

export interface WalletBalanceSnapshot {
  balanceCents: number;
  currency: 'ARS';
}

export interface RecordWithdrawalInput {
  userId: string;
  bankAccount: BankAccount;
  amountCents: number;
  currency: 'ARS';
  providerName: string;
  providerTransactionId: string;
  providerStatus: 'processed' | 'processing' | 'failed';
  providerMetadata: Record<string, unknown>;
  status: 'processed' | 'processing' | 'failed';
  referenceId: string;
  processedAt: Date | null;
  createdAt: Date;
}

export interface RecordDisputePenaltyInput {
  disputeResolutionId: string | null;
  responsibleUserId: string;
  perjudicadoUserId: string;
  amountCents: number;
  currency: 'ARS';
}

export interface WalletRepository {
  getBalance(userId: string): Promise<WalletBalanceSnapshot>;
  findTransactionsByUserId(userId: string): Promise<WalletTransaction[]>;
  recordReservationPayout(reservation: Reservation): Promise<void>;
  recordWithdrawal(input: RecordWithdrawalInput): Promise<Withdrawal>;
  recordDisputePenalty(input: RecordDisputePenaltyInput): Promise<void>;
}

export const WALLET_REPOSITORY = Symbol('WalletRepository');
