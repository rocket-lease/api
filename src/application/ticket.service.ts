import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  type CreateTicketRequest,
  type GetAdminTicketsResponse,
  type GetMyTicketsResponse,
  type GetReservationTicketsResponse,
  type GetTicketsAgainstMeResponse,
  type RateTicketRequest,
  type TicketResponse,
  type UpdateTicketStatusRequest,
  TicketResponseSchema,
} from '@rocket-lease/contracts';
import { Ticket } from '@/domain/entities/ticket.entity';
import { AdminAccessRequiredException } from '@/domain/exceptions/domain.exception';
import {
  TicketAlreadyExistsException,
  TicketAlreadyRatedException,
  TicketRatingNotAllowedException,
  TicketReservationInvalidStatusException,
} from '@/domain/exceptions/ticket.exception';
import {
  ReservationForbiddenException,
  ReservationNotFoundException,
} from '@/domain/exceptions/reservation.exception';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';
import type { TicketRepository } from '@/domain/repositories/ticket.repository';
import { TICKET_REPOSITORY } from '@/domain/repositories/ticket.repository';
import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import type { NotificationProvider } from '@/domain/providers/notification.provider';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';
import { WalletService } from '@/application/wallet.service';

const TICKET_ALLOWED_STATUSES = new Set(['in_progress', 'completed']);
const RATEABLE_STATUSES = new Set(['resolved', 'rejected']);

@Injectable()
export class TicketService {
  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: TicketRepository,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: UserRepository,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
    @Inject(WalletService)
    private readonly walletService: WalletService,
  ) {}

  private async assertAdmin(callerId: string): Promise<void> {
    const user = await this.userRepo.findById(callerId);
    if (!user || !user.getIsAdmin()) {
      throw new AdminAccessRequiredException();
    }
  }

  async create(callerId: string, dto: CreateTicketRequest): Promise<TicketResponse> {
    if (!dto.reservationId) {
      const ticket = Ticket.create({
        id: randomUUID(),
        reservationId: null,
        type: dto.type,
        reportedBy: null,
        reporterId: callerId,
        subject: dto.subject,
        description: dto.description,
        photoUrls: dto.photoUrls,
      });
      const saved = await this.ticketRepo.save(ticket);
      return this.toResponse(saved);
    }

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
      subject: dto.subject,
      description: dto.description,
      photoUrls: dto.photoUrls,
    });

    const saved = await this.ticketRepo.save(ticket);

    const counterpartId = isConductor
      ? reservation.getRentadorId()
      : reservation.getConductorId();

    if (counterpartId !== callerId) {
      void this.notificationProvider.notify(
        counterpartId,
        'Nuevo reporte de problema',
        'Se reportó un problema en tu reserva.',
        { url: `/reservas/${dto.reservationId}` },
      );
    }

    return this.toResponse(saved);
  }

  async getMyTickets(userId: string): Promise<GetMyTicketsResponse> {
    const tickets = await this.ticketRepo.findByReporterId(userId);
    return tickets.map((t) => this.toResponse(t));
  }

  async getByReservationId(
    callerId: string,
    reservationId: string,
  ): Promise<GetReservationTicketsResponse> {
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    const isConductor = reservation.getConductorId() === callerId;
    const isRentador = reservation.getRentadorId() === callerId;
    if (!isConductor && !isRentador) throw new ReservationForbiddenException();
    const tickets = await this.ticketRepo.findByReservationId(reservationId);
    return tickets.map((t) => this.toResponse(t));
  }

  async getAgainstMe(userId: string): Promise<GetTicketsAgainstMeResponse> {
    const tickets = await this.ticketRepo.findAgainstUser(userId);
    return tickets.map((t) => this.toResponse(t));
  }

  private async getCounterpartId(ticket: Ticket): Promise<string | null> {
    if (!ticket.getReservationId() || !ticket.getReportedBy()) return null;
    const reservation = await this.reservationRepo.findById(ticket.getReservationId() as string);
    if (!reservation) return null;
    return ticket.getReportedBy() === 'conductor'
      ? reservation.getRentadorId()
      : reservation.getConductorId();
  }

  async getDetail(callerId: string, ticketId: string): Promise<TicketResponse> {
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);
    if (ticket.getReporterId() === callerId) return this.toResponse(ticket);

    const counterpartId = await this.getCounterpartId(ticket);
    if (counterpartId === callerId) return this.toResponse(ticket);

    const caller = await this.userRepo.findById(callerId);
    if (caller?.getIsAdmin()) {
      const parties = await this.getReservationParties(ticket);
      return this.toResponse(ticket, parties);
    }

    throw new ReservationForbiddenException();
  }

  private async getReservationParties(ticket: Ticket): Promise<{ conductorId: string; rentadorId: string } | null> {
    if (!ticket.getReservationId()) return null;
    const reservation = await this.reservationRepo.findById(ticket.getReservationId() as string);
    if (!reservation) return null;
    return { conductorId: reservation.getConductorId(), rentadorId: reservation.getRentadorId() };
  }

  async rate(callerId: string, ticketId: string, dto: RateTicketRequest): Promise<TicketResponse> {
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);
    if (ticket.getReporterId() !== callerId) throw new ReservationForbiddenException();
    if (!RATEABLE_STATUSES.has(ticket.getStatus())) {
      throw new TicketRatingNotAllowedException();
    }
    if (ticket.getRating() !== null) throw new TicketAlreadyRatedException();

    const rated = ticket.withRating(dto.rating);
    const saved = await this.ticketRepo.save(rated);
    return this.toResponse(saved);
  }

  async getForAdmin(adminId: string): Promise<GetAdminTicketsResponse> {
    await this.assertAdmin(adminId);
    const tickets = await this.ticketRepo.findOpenForAdmin();
    return tickets.map((t) => this.toResponse(t));
  }

  async updateStatus(
    adminId: string,
    ticketId: string,
    dto: UpdateTicketStatusRequest,
  ): Promise<TicketResponse> {
    await this.assertAdmin(adminId);
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);

    if (dto.compensation) {
      const reservationId = ticket.getReservationId();
      if (!reservationId) throw new InvalidEntityDataException('cannot compensate a ticket without a reservation');
      const reservation = await this.reservationRepo.findById(reservationId);
      if (!reservation) throw new ReservationNotFoundException(reservationId);

      const { responsibleUserId, amountCents } = dto.compensation;
      const isConductorResponsible = reservation.getConductorId() === responsibleUserId;
      const isRentadorResponsible = reservation.getRentadorId() === responsibleUserId;
      if (!isConductorResponsible && !isRentadorResponsible) {
        throw new InvalidEntityDataException('responsible user is not part of the reservation');
      }
      const perjudicadoUserId = isConductorResponsible
        ? reservation.getRentadorId()
        : reservation.getConductorId();

      await this.walletService.applyDisputePenalty({
        disputeResolutionId: null,
        responsibleUserId,
        perjudicadoUserId,
        amountCents,
      });
    }

    const updated = ticket.withStatus(dto.status);
    const saved = await this.ticketRepo.save(updated);

    void this.notificationProvider.notify(
      saved.getReporterId(),
      'Tu ticket fue actualizado',
      `Tu ticket "${saved.getSubject()}" ahora está en estado "${saved.getStatus()}".`,
      { url: `/soporte/tickets/${saved.getId()}` },
    );

    return this.toResponse(saved);
  }

  private toResponse(ticket: Ticket, parties?: { conductorId: string; rentadorId: string } | null): TicketResponse {
    return TicketResponseSchema.parse({
      id: ticket.getId(),
      reservationId: ticket.getReservationId(),
      type: ticket.getType(),
      reportedBy: ticket.getReportedBy(),
      reporterId: ticket.getReporterId(),
      conductorId: parties?.conductorId ?? null,
      rentadorId: parties?.rentadorId ?? null,
      status: ticket.getStatus(),
      subject: ticket.getSubject(),
      description: ticket.getDescription(),
      photoUrls: ticket.getPhotoUrls(),
      rating: ticket.getRating(),
      createdAt: ticket.getCreatedAt().toISOString(),
      updatedAt: ticket.getUpdatedAt().toISOString(),
    });
  }
}
