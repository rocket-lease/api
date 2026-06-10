import { Injectable, Inject } from '@nestjs/common';
import { DisputeResolution } from '@/domain/entities/dispute-resolution.entity';
import type { DisputeResolutionRepository } from '@/domain/repositories/dispute-resolution.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

type DisputeResolutionRow = {
  id: string;
  ticketId: string;
  status: string;
  moderatorId: string | null;
  infoRequestedAt: Date | null;
  infoDeadlineAt: Date | null;
  verdict: string | null;
  responsibleUserId: string | null;
  penaltyType: string | null;
  penaltyAmountCents: number | null;
  penaltyPercentage: number | null;
  ruledAt: Date | null;
  appealCount: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PostgresDisputeResolutionRepository implements DisputeResolutionRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private toDomain(row: DisputeResolutionRow): DisputeResolution {
    return DisputeResolution.fromPersistence({
      id: row.id,
      ticketId: row.ticketId,
      status: row.status as 'escalated' | 'awaiting_info' | 'ruled' | 'appealed' | 'closed',
      moderatorId: row.moderatorId,
      infoRequestedAt: row.infoRequestedAt,
      infoDeadlineAt: row.infoDeadlineAt,
      verdict: row.verdict,
      responsibleUserId: row.responsibleUserId,
      penaltyType: row.penaltyType as 'fixed' | 'percentage' | null,
      penaltyAmountCents: row.penaltyAmountCents,
      penaltyPercentage: row.penaltyPercentage,
      ruledAt: row.ruledAt,
      appealCount: row.appealCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(dispute: DisputeResolution): Promise<DisputeResolution> {
    const data = {
      status: dispute.getStatus(),
      moderatorId: dispute.getModeratorId(),
      infoRequestedAt: dispute.getInfoRequestedAt(),
      infoDeadlineAt: dispute.getInfoDeadlineAt(),
      verdict: dispute.getVerdict(),
      responsibleUserId: dispute.getResponsibleUserId(),
      penaltyType: dispute.getPenaltyType(),
      penaltyAmountCents: dispute.getPenaltyAmountCents(),
      penaltyPercentage: dispute.getPenaltyPercentage(),
      ruledAt: dispute.getRuledAt(),
      appealCount: dispute.getAppealCount(),
      updatedAt: dispute.getUpdatedAt(),
    };

    const row = await this.prisma.disputeResolution.upsert({
      where: { id: dispute.getId() },
      create: {
        id: dispute.getId(),
        ticketId: dispute.getTicketId(),
        createdAt: dispute.getCreatedAt(),
        ...data,
      },
      update: data,
    });

    return this.toDomain(row);
  }

  async findByTicketId(ticketId: string): Promise<DisputeResolution | null> {
    const row = await this.prisma.disputeResolution.findUnique({ where: { ticketId } });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<DisputeResolution | null> {
    const row = await this.prisma.disputeResolution.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }
}
