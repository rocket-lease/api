import { Injectable, Inject } from '@nestjs/common';
import { Ticket } from '@/domain/entities/ticket.entity';
import type { TicketRepository } from '@/domain/repositories/ticket.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PostgresTicketRepository implements TicketRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private toDomain(row: {
    id: string;
    reservationId: string;
    type: string;
    reportedBy: string;
    reporterId: string;
    status: string;
    description: string;
    photoUrls: string[];
    createdAt: Date;
    updatedAt: Date;
  }): Ticket {
    return Ticket.fromPersistence({
      id: row.id,
      reservationId: row.reservationId,
      type: row.type as 'vehicle_issue' | 'counterpart_report',
      reportedBy: row.reportedBy as 'conductor' | 'rentador',
      reporterId: row.reporterId,
      status: row.status as 'open' | 'under_review' | 'resolved' | 'rejected',
      description: row.description,
      photoUrls: row.photoUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(ticket: Ticket): Promise<Ticket> {
    const row = await this.prisma.ticket.create({
      data: {
        id: ticket.getId(),
        reservationId: ticket.getReservationId(),
        type: ticket.getType(),
        reportedBy: ticket.getReportedBy(),
        reporterId: ticket.getReporterId(),
        status: ticket.getStatus(),
        description: ticket.getDescription(),
        photoUrls: ticket.getPhotoUrls(),
      },
    });
    return this.toDomain(row);
  }

  async findByReservationAndReporter(
    reservationId: string,
    reportedBy: 'conductor' | 'rentador',
  ): Promise<Ticket | null> {
    const row = await this.prisma.ticket.findUnique({
      where: { reservationId_reportedBy: { reservationId, reportedBy } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByReporterId(reporterId: string): Promise<Ticket[]> {
    const rows = await this.prisma.ticket.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }
}
