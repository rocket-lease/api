import { Injectable, Inject } from '@nestjs/common';
import { Ticket } from '@/domain/entities/ticket.entity';
import type { TicketRepository } from '@/domain/repositories/ticket.repository';
import { TicketNotFoundException } from '@/domain/exceptions/ticket.exception';
import { PrismaService } from '@/infrastructure/database/prisma.service';

const ADMIN_QUEUE_STATUSES = ['open', 'under_review', 'resolved', 'rejected'] as const;

@Injectable()
export class PostgresTicketRepository implements TicketRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private toDomain(row: {
    id: string;
    reservationId: string | null;
    type: string;
    reportedBy: string | null;
    reporterId: string;
    status: string;
    subject: string;
    description: string;
    photoUrls: string[];
    rating: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): Ticket {
    return Ticket.fromPersistence({
      id: row.id,
      reservationId: row.reservationId,
      type: row.type as 'vehicle_issue' | 'counterpart_report' | 'support_request',
      reportedBy: row.reportedBy as 'conductor' | 'rentador' | null,
      reporterId: row.reporterId,
      status: row.status as 'open' | 'under_review' | 'resolved' | 'rejected',
      subject: row.subject,
      description: row.description,
      photoUrls: row.photoUrls,
      rating: row.rating,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(ticket: Ticket): Promise<Ticket> {
    const row = await this.prisma.ticket.upsert({
      where: { id: ticket.getId() },
      create: {
        id: ticket.getId(),
        reservationId: ticket.getReservationId(),
        type: ticket.getType(),
        reportedBy: ticket.getReportedBy(),
        reporterId: ticket.getReporterId(),
        status: ticket.getStatus(),
        subject: ticket.getSubject(),
        description: ticket.getDescription(),
        photoUrls: ticket.getPhotoUrls(),
        rating: ticket.getRating(),
      },
      update: {
        status: ticket.getStatus(),
        subject: ticket.getSubject(),
        description: ticket.getDescription(),
        photoUrls: ticket.getPhotoUrls(),
        rating: ticket.getRating(),
      },
    });
    return this.toDomain(row);
  }

  async findByReservationAndReporter(
    reservationId: string,
    reportedBy: 'conductor' | 'rentador',
  ): Promise<Ticket | null> {
    const row = await this.prisma.ticket.findFirst({
      where: { reservationId, reportedBy },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByReservationId(reservationId: string): Promise<Ticket[]> {
    const rows = await this.prisma.ticket.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByReporterId(reporterId: string): Promise<Ticket[]> {
    const rows = await this.prisma.ticket.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findAgainstUser(userId: string): Promise<Ticket[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: { OR: [{ conductorId: userId }, { rentadorId: userId }] },
      select: { id: true, conductorId: true, rentadorId: true },
    });

    if (reservations.length === 0) return [];

    const conditions: Array<{
      reservationId: string;
      reportedBy: 'conductor' | 'rentador';
    }> = [];

    for (const r of reservations) {
      if (r.conductorId === userId) {
        conditions.push({ reservationId: r.id, reportedBy: 'rentador' });
      }
      if (r.rentadorId === userId) {
        conditions.push({ reservationId: r.id, reportedBy: 'conductor' });
      }
    }

    if (conditions.length === 0) return [];

    const rows = await this.prisma.ticket.findMany({
      where: { OR: conditions },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Ticket | null> {
    const row = await this.prisma.ticket.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByIdOrThrow(id: string): Promise<Ticket> {
    const ticket = await this.findById(id);
    if (!ticket) throw new TicketNotFoundException();
    return ticket;
  }

  async findOpenForAdmin(): Promise<Ticket[]> {
    const rows = await this.prisma.ticket.findMany({
      where: { status: { in: [...ADMIN_QUEUE_STATUSES] } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }
}
