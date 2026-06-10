import { TicketMessage } from '../entities/ticket-message.entity';

export interface TicketMessageRepository {
  save(message: TicketMessage): Promise<TicketMessage>;
  findByChannel(ticketId: string, channelParticipantId: string, after?: Date): Promise<TicketMessage[]>;
}

export const TICKET_MESSAGE_REPOSITORY = Symbol('TicketMessageRepository');
