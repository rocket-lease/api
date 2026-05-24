import { randomUUID } from 'node:crypto';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

export interface MessageProps {
  id?: string;
  reservationId: string;
  senderId: string;
  body: string;
  sentAt?: Date;
}

export class Message {
  readonly id: string;
  readonly reservationId: string;
  readonly senderId: string;
  readonly body: string;
  readonly sentAt: Date;

  constructor(props: MessageProps) {
    const trimmed = props.body.trim();
    if (!trimmed || trimmed.length > 1000) {
      throw new InvalidEntityDataException(
        'body must be between 1 and 1000 characters',
      );
    }
    this.id = props.id ?? randomUUID();
    this.reservationId = props.reservationId;
    this.senderId = props.senderId;
    this.body = trimmed;
    this.sentAt = props.sentAt ?? new Date();
  }
}
