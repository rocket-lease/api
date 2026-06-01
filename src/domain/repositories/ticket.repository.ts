import type { Ticket } from '@/domain/entities/ticket.entity';

export abstract class TicketRepository {
  abstract save(ticket: Ticket): Promise<Ticket>;
  abstract findByReservationAndReporter(
    reservationId: string,
    reportedBy: 'conductor' | 'rentador',
  ): Promise<Ticket | null>;
  abstract findByReporterId(reporterId: string): Promise<Ticket[]>;
}

export const TICKET_REPOSITORY = Symbol('TicketRepository');
