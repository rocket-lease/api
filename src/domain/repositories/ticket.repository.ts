import type { Ticket } from '@/domain/entities/ticket.entity';

export abstract class TicketRepository {
  abstract save(ticket: Ticket): Promise<Ticket>;
  abstract findByReservationAndReporter(
    reservationId: string,
    reportedBy: 'conductor' | 'rentador',
  ): Promise<Ticket | null>;
  abstract findByReservationId(reservationId: string): Promise<Ticket[]>;
  abstract findByReporterId(reporterId: string): Promise<Ticket[]>;
  abstract findAgainstUser(userId: string): Promise<Ticket[]>;
  abstract findById(id: string): Promise<Ticket | null>;
  abstract findByIdOrThrow(id: string): Promise<Ticket>;
  abstract findOpenForAdmin(): Promise<Ticket[]>;
}

export const TICKET_REPOSITORY = Symbol('TicketRepository');
