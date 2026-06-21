import { Injectable, Inject } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { Penalty, type PenaltyRole } from '@/domain/entities/penalty.entity';
import type {
  ReputationRepository,
  ReputationData,
} from '@/domain/repositories/reputation.repository';

/** Cliente Prisma con los delegates de modelo, sea el base o uno transaccional. */
type PrismaModelClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PostgresReputationRepository implements ReputationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Usa el cliente transaccional si vino, o el cliente por defecto. */
  private client(tx?: unknown): PrismaModelClient {
    return (tx as Prisma.TransactionClient) ?? this.prisma;
  }

  async getReputationData(userId: string, tx?: unknown): Promise<ReputationData> {
    const row = await this.client(tx).reputation.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return {
      id: row.id,
      userId: row.userId,
      scoreAsDriver: row.scoreAsDriver,
      scoreAsRenter: row.scoreAsRenter,
      reviewCountAsDriver: row.reviewCountAsDriver,
      reviewCountAsRenter: row.reviewCountAsRenter,
      penaltyCountAsDriver: row.penaltyCountAsDriver,
      penaltyCountAsRenter: row.penaltyCountAsRenter,
      suspendedAsDriver: row.suspendedAsDriver,
      suspendedAsRenter: row.suspendedAsRenter,
    };
  }

  async savePenalty(penalty: Penalty, tx?: unknown): Promise<Penalty> {
    const row = await this.client(tx).penalty.create({
      data: {
        id: penalty.getId(),
        userId: penalty.getUserId(),
        role: penalty.getRole(),
        ticketId: penalty.getTicketId(),
        reason: penalty.getReason(),
        scoreDeduction: penalty.getScoreDeduction(),
        appliedAt: penalty.getAppliedAt(),
      },
    });
    return new Penalty({
      id: row.id,
      userId: row.userId,
      role: row.role as PenaltyRole,
      ticketId: row.ticketId,
      reason: row.reason,
      scoreDeduction: row.scoreDeduction,
      appliedAt: row.appliedAt,
    });
  }

  async findPenaltyByTicketAndUser(
    ticketId: string,
    userId: string,
    tx?: unknown,
  ): Promise<Penalty | null> {
    const row = await this.client(tx).penalty.findUnique({
      where: { ticketId_userId: { ticketId, userId } },
    });
    if (!row) return null;
    return new Penalty({
      id: row.id,
      userId: row.userId,
      role: row.role as PenaltyRole,
      ticketId: row.ticketId,
      reason: row.reason,
      scoreDeduction: row.scoreDeduction,
      appliedAt: row.appliedAt,
    });
  }

  async updateScoreAndCounts(
    userId: string,
    role: PenaltyRole,
    score: number,
    reviewCount: number,
    tx?: unknown,
  ): Promise<void> {
    const updateData =
      role === 'conductor'
        ? { scoreAsDriver: score, reviewCountAsDriver: reviewCount }
        : { scoreAsRenter: score, reviewCountAsRenter: reviewCount };

    await this.client(tx).reputation.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
      },
    });
  }

  async updatePenaltyCountAndSuspension(
    userId: string,
    role: PenaltyRole,
    penaltyCount: number,
    suspended: boolean,
    tx?: unknown,
  ): Promise<void> {
    const updateData =
      role === 'conductor'
        ? { penaltyCountAsDriver: penaltyCount, suspendedAsDriver: suspended }
        : { penaltyCountAsRenter: penaltyCount, suspendedAsRenter: suspended };

    await this.client(tx).reputation.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
      },
    });
  }

  async updateVehicleOwnerReputationScore(
    ownerId: string,
    score: number,
    tx?: unknown,
  ): Promise<void> {
    await this.client(tx).vehicle.updateMany({
      where: { ownerId },
      data: { ownerReputationScore: score },
    });
  }

  async getAverageRatingAsTarget(
    userId: string,
    targetType: PenaltyRole,
  ): Promise<{ avg: number; count: number }> {
    const result = await this.prisma.review.aggregate({
      where: { reviewedId: userId, targetType },
      _avg: { rating: true },
      _count: { id: true },
    });
    return {
      avg: result._avg.rating ?? 0,
      count: result._count.id,
    };
  }
}
