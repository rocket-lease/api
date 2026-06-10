import { Injectable, Inject } from '@nestjs/common';
import { Prisma, type Withdrawal as PrismaWithdrawal } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { Reservation } from '@/domain/entities/reservation.entity';
import { WalletTransaction } from '@/domain/entities/wallet-transaction.entity';
import { Withdrawal } from '@/domain/entities/withdrawal.entity';
import type { WalletBalanceSnapshot, WalletRepository, RecordWithdrawalInput, RecordDisputePenaltyInput } from '@/domain/repositories/wallet.repository';
import { InsufficientBalanceException } from '@/domain/exceptions/wallet.exception';

type WalletMovementRow = {
  id: string;
  userId: string;
  type: 'reservation_credit' | 'withdrawal_debit' | 'dispute_penalty_debit' | 'dispute_penalty_credit';
  amountCents: number;
  currency: string;
  reservationId: string | null;
  withdrawalId: string | null;
  providerTransactionId: string | null;
  bankAccountId: string | null;
  bankAccountAlias: string | null;
  bankAccountMaskedCbu: string | null;
  providerStatus: 'processed' | 'processing' | 'failed' | null;
  balanceAfterCents: number;
  createdAt: Date;
};

@Injectable()
export class PostgresWalletRepository implements WalletRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getBalance(userId: string): Promise<WalletBalanceSnapshot> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balanceInCents: true },
    });
    return { balanceCents: row?.balanceInCents ?? 0, currency: 'ARS' };
  }

  async findTransactionsByUserId(userId: string): Promise<WalletTransaction[]> {
    const rows = await this.prisma.walletMovement.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toMovementEntity(row));
  }

  async recordReservationPayout(reservation: Reservation): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: reservation.getRentadorId() },
        select: { balanceInCents: true },
      });
      if (!user) {
        throw new InsufficientBalanceException(); // TODO(juanma): raro el error este, deberia ser otro
      }

      const updatedReservation = await tx.reservation.update({
        where: { id: reservation.getId() },
        data: this.toReservationRow(reservation),
      });

      const balanceAfterCents = user.balanceInCents + reservation.getTotalCents();
      await tx.user.update({
        where: { id: reservation.getRentadorId() },
        data: { balanceInCents: { increment: reservation.getTotalCents() } },
      });

      await tx.walletMovement.create({
        data: {
          id: randomUUID(),
          userId: reservation.getRentadorId(),
          type: 'reservation_credit',
          amountCents: reservation.getTotalCents(),
          currency: reservation.getCurrency(),
          reservationId: reservation.getId(),
          withdrawalId: null,
          providerTransactionId: null,
          bankAccountId: null,
          bankAccountAlias: null,
          bankAccountMaskedCbu: null,
          providerStatus: null,
          balanceAfterCents,
          createdAt: updatedReservation.completedAt ?? new Date(),
        },
      });
    });
  }

  async recordWithdrawal(input: RecordWithdrawalInput): Promise<Withdrawal> {
    const row = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: { balanceInCents: true },
      });
      if (!user || user.balanceInCents < input.amountCents) {
        throw new InsufficientBalanceException();
      }

      const balanceAfterCents = user.balanceInCents - input.amountCents;
      const withdrawal = await tx.withdrawal.create({
        data: {
          id: input.referenceId,
          userId: input.userId,
          bankAccountId: input.bankAccount.getId(),
          bankAccountAlias: input.bankAccount.getAlias(),
          bankAccountMaskedCbu: `${input.bankAccount.getCbu().slice(0, 4)}${'*'.repeat(14)}${input.bankAccount.getCbu().slice(-4)}`,
          bankAccountProvider: input.bankAccount.getProvider(),
          amountCents: input.amountCents,
          currency: input.currency,
          providerName: input.providerName,
          providerTransactionId: input.providerTransactionId,
          providerStatus: input.providerStatus,
          status: input.status,
          providerMetadata: input.providerMetadata as InputJsonValue,
          balanceAfterCents,
          processedAt: input.processedAt,
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        },
      });

      await tx.walletMovement.create({
        data: {
          id: input.referenceId,
          userId: input.userId,
          type: 'withdrawal_debit',
          amountCents: input.amountCents,
          currency: input.currency,
          reservationId: null,
          withdrawalId: withdrawal.id,
          providerTransactionId: input.providerTransactionId,
          bankAccountId: input.bankAccount.getId(),
          bankAccountAlias: input.bankAccount.getAlias(),
          bankAccountMaskedCbu: `${input.bankAccount.getCbu().slice(0, 4)}${'*'.repeat(14)}${input.bankAccount.getCbu().slice(-4)}`,
          providerStatus: input.providerStatus,
          balanceAfterCents,
          createdAt: input.createdAt,
        },
      });

      await tx.user.update({
        where: { id: input.userId },
        data: { balanceInCents: { decrement: input.amountCents } },
      });

      return withdrawal;
    });

    return this.toWithdrawalEntity(row);
  }

  async recordDisputePenalty(input: RecordDisputePenaltyInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const responsible = await tx.user.findUnique({
        where: { id: input.responsibleUserId },
        select: { balanceInCents: true },
      });
      if (!responsible) {
        throw new InsufficientBalanceException();
      }
      const responsibleBalanceAfter = responsible.balanceInCents - input.amountCents;

      await tx.user.update({
        where: { id: input.responsibleUserId },
        data: { balanceInCents: { decrement: input.amountCents } },
      });

      await tx.walletMovement.create({
        data: {
          id: randomUUID(),
          userId: input.responsibleUserId,
          type: 'dispute_penalty_debit',
          amountCents: input.amountCents,
          currency: input.currency,
          reservationId: null,
          withdrawalId: null,
          providerTransactionId: null,
          bankAccountId: null,
          bankAccountAlias: null,
          bankAccountMaskedCbu: null,
          providerStatus: null,
          disputeResolutionId: input.disputeResolutionId,
          balanceAfterCents: responsibleBalanceAfter,
          createdAt: now,
        },
      });

      const perjudicado = await tx.user.findUnique({
        where: { id: input.perjudicadoUserId },
        select: { balanceInCents: true },
      });
      if (!perjudicado) {
        throw new InsufficientBalanceException();
      }
      const perjudicadoBalanceAfter = perjudicado.balanceInCents + input.amountCents;

      await tx.user.update({
        where: { id: input.perjudicadoUserId },
        data: { balanceInCents: { increment: input.amountCents } },
      });

      await tx.walletMovement.create({
        data: {
          id: randomUUID(),
          userId: input.perjudicadoUserId,
          type: 'dispute_penalty_credit',
          amountCents: input.amountCents,
          currency: input.currency,
          reservationId: null,
          withdrawalId: null,
          providerTransactionId: null,
          bankAccountId: null,
          bankAccountAlias: null,
          bankAccountMaskedCbu: null,
          providerStatus: null,
          disputeResolutionId: null,
          balanceAfterCents: perjudicadoBalanceAfter,
          createdAt: now,
        },
      });
    });
  }

  private toMovementEntity(row: WalletMovementRow): WalletTransaction {
    return new WalletTransaction({
      id: row.id,
      userId: row.userId,
      type: row.type,
      amountCents: row.amountCents,
      currency: 'ARS',
      reservationId: row.reservationId,
      withdrawalId: row.withdrawalId,
      providerTransactionId: row.providerTransactionId,
      bankAccountId: row.bankAccountId,
      bankAccountAlias: row.bankAccountAlias,
      bankAccountMaskedCbu: row.bankAccountMaskedCbu,
      providerStatus: row.providerStatus,
      balanceAfterCents: row.balanceAfterCents,
      createdAt: row.createdAt,
    });
  }

  private toWithdrawalEntity(row: PrismaWithdrawal): Withdrawal {
    return new Withdrawal({
      id: row.id,
      userId: row.userId,
      bankAccountId: row.bankAccountId,
      bankAccountAlias: row.bankAccountAlias,
      bankAccountMaskedCbu: row.bankAccountMaskedCbu,
      bankAccountProvider: row.bankAccountProvider,
      amountCents: row.amountCents,
      currency: row.currency as 'ARS',
      providerName: row.providerName,
      providerTransactionId: row.providerTransactionId,
      providerStatus: row.providerStatus,
      status: row.status,
      providerMetadata: row.providerMetadata as Record<string, unknown>,
      balanceAfterCents: row.balanceAfterCents,
      createdAt: row.createdAt,
      processedAt: row.processedAt,
      updatedAt: row.updatedAt,
    });
  }

  private toReservationRow(reservation: Reservation): Prisma.ReservationUncheckedUpdateInput {
    const maxKilometrageSnapshot = reservation.getMaxKilometrageSnapshot();
    const rentalTimeConstraintsSnapshot = reservation.getRentalTimeConstraintsSnapshot();
    return {
      vehicleId: reservation.getVehicleId(),
      conductorId: reservation.getConductorId(),
      rentadorId: reservation.getRentadorId(),
      status: reservation.getStatus(),
      startAt: reservation.getStartAt(),
      endAt: reservation.getEndAt(),
      holdExpiresAt: reservation.getHoldExpiresAt(),
      totalCents: reservation.getTotalCents(),
      currency: reservation.getCurrency(),
      paymentMethod: reservation.getPaymentMethod(),
      walletProvider: reservation.getWalletProvider(),
      contractAcceptedAt: reservation.getContractAcceptedAt(),
      paidAt: reservation.getPaidAt(),
      voucherToken: reservation.getVoucherToken(),
      returnQrToken: reservation.getReturnQrToken(),
      startedAt: reservation.getStartedAt(),
      completedAt: reservation.getCompletedAt(),
      rejectionReason: reservation.getRejectionReason(),
      transferExpiresAt: reservation.getTransferExpiresAt(),
      transferCode: reservation.getTransferCode(),
      transferAlias: reservation.getTransferAlias(),
      depositPercentageSnapshot: reservation.getDepositPercentageSnapshot(),
      basePriceCentsSnapshot: reservation.getBasePriceCentsSnapshot(),
      cancellationPolicySnapshot: reservation.getCancellationPolicySnapshot(),
      maxKilometrageTypeSnapshot: maxKilometrageSnapshot.type,
      maxKilometrageValueSnapshot:
        maxKilometrageSnapshot.type === 'UNLIMITED'
          ? null
          : maxKilometrageSnapshot.value,
      minRentalDaysSnapshot: rentalTimeConstraintsSnapshot.minDays,
      maxRentalDaysSnapshot: rentalTimeConstraintsSnapshot.maxDays ?? null,
      createdAt: reservation.getCreatedAt(),
      updatedAt: reservation.getUpdatedAt(),
    };
  }
}