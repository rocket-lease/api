import { TicketMessage } from '../entities/ticket-message.entity';

export interface TicketMessageRepository {
  save(message: TicketMessage): Promise<TicketMessage>;
  findByChannel(ticketId: string, channelParticipantId: string, after?: Date): Promise<TicketMessage[]>;
  countByTicketId(ticketId: string): Promise<number>;
}

export const TICKET_MESSAGE_REPOSITORY = Symbol('TicketMessageRepository');
