import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  type CreateTicketRequest,
  type GetMyTicketsResponse,
  type TicketResponse,
  TicketResponseSchema,
} from '@rocket-lease/contracts';
import { Ticket } from '@/domain/entities/ticket.entity';
import {
  TicketAlreadyExistsException,
  TicketReservationInvalidStatusException,
} from '@/domain/exceptions/ticket.exception';
import {
  ReservationForbiddenException,
  ReservationNotFoundException,
} from '@/domain/exceptions/reservation.exception';
import type { TicketRepository } from '@/domain/repositories/ticket.repository';
import { TICKET_REPOSITORY } from '@/domain/repositories/ticket.repository';
import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';
import type { NotificationProvider } from '@/domain/providers/notification.provider';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';

const TICKET_ALLOWED_STATUSES = new Set(['in_progress', 'completed']);

@Injectable()
export class TicketService {
  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: TicketRepository,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepository,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
  ) {}

  async create(callerId: string, dto: CreateTicketRequest): Promise<TicketResponse> {
    const reservation = await this.reservationRepo.findById(dto.reservationId);
    if (!reservation) throw new ReservationNotFoundException(dto.reservationId);

    const isConductor = reservation.getConductorId() === callerId;
    const isRentador = reservation.getRentadorId() === callerId;
    if (!isConductor && !isRentador) throw new ReservationForbiddenException();

    if (!TICKET_ALLOWED_STATUSES.has(reservation.getStatus())) {
      throw new TicketReservationInvalidStatusException();
    }

    const reportedBy = isConductor ? 'conductor' : 'rentador';

    const existing = await this.ticketRepo.findByReservationAndReporter(
      dto.reservationId,
      reportedBy,
    );
    if (existing) throw new TicketAlreadyExistsException();

    const ticket = Ticket.create({
      id: randomUUID(),
      reservationId: dto.reservationId,
      type: dto.type,
      reportedBy,
      reporterId: callerId,
      description: dto.description,
      photoUrls: dto.photoUrls,
    });

    const saved = await this.ticketRepo.save(ticket);

    const counterpartId = isConductor
      ? reservation.getRentadorId()
      : reservation.getConductorId();

    void this.notificationProvider.notify(
      counterpartId,
      'Nuevo reporte de problema',
      'Se reportó un problema en tu reserva.',
      { url: `/reservas/${dto.reservationId}` },
    );

    return this.toResponse(saved);
  }

  async getMyTickets(userId: string): Promise<GetMyTicketsResponse> {
    const tickets = await this.ticketRepo.findByReporterId(userId);
    return tickets.map((t) => this.toResponse(t));
  }

  private toResponse(ticket: Ticket): TicketResponse {
    return TicketResponseSchema.parse({
      id: ticket.getId(),
      reservationId: ticket.getReservationId(),
      type: ticket.getType(),
      reportedBy: ticket.getReportedBy(),
      status: ticket.getStatus(),
      description: ticket.getDescription(),
      photoUrls: ticket.getPhotoUrls(),
      createdAt: ticket.getCreatedAt().toISOString(),
      updatedAt: ticket.getUpdatedAt().toISOString(),
    });
  }
}
