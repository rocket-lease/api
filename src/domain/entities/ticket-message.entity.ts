import { randomUUID } from 'node:crypto';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

export type TicketMessageType = 'user' | 'info_request';

export interface TicketMessageProps {
  id?: string;
  ticketId: string;
  senderId: string;
  channelParticipantId: string;
  messageType?: TicketMessageType;
  body: string;
  sentAt?: Date;
}

export class TicketMessage {
  readonly id: string;
  readonly ticketId: string;
  readonly senderId: string;
  readonly channelParticipantId: string;
  readonly messageType: TicketMessageType;
  readonly body: string;
  readonly sentAt: Date;

  constructor(props: TicketMessageProps) {
    const trimmed = props.body.trim();
    if (!trimmed || trimmed.length > 1000) {
      throw new InvalidEntityDataException(
        'body must be between 1 and 1000 characters',
      );
    }
    this.id = props.id ?? randomUUID();
    this.ticketId = props.ticketId;
    this.senderId = props.senderId;
    this.channelParticipantId = props.channelParticipantId;
    this.messageType = props.messageType ?? 'user';
    this.body = trimmed;
    this.sentAt = props.sentAt ?? new Date();
  }
}
