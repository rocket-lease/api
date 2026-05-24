import { Message } from '../entities/message.entity';

export interface MessageRepository {
  save(message: Message): Promise<Message>;
  findByReservation(reservationId: string, after?: Date): Promise<Message[]>;
}

export const MESSAGE_REPOSITORY = Symbol('MessageRepository');
