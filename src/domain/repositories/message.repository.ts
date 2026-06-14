import { Message } from '../entities/message.entity';

export interface MessageRepository {
  save(message: Message): Promise<Message>;
  findByReservation(reservationId: string, after?: Date): Promise<Message[]>;
  upsertLastSeen(userId: string, reservationId: string, lastSeenAt: Date): Promise<void>;
  getLastSeen(userId: string, reservationId: string): Promise<Date | null>;
}

export const MESSAGE_REPOSITORY = Symbol('MessageRepository');
