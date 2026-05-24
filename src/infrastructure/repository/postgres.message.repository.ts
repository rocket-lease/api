import { Injectable, Inject } from '@nestjs/common';
import { Message } from '@/domain/entities/message.entity';
import type { MessageRepository } from '@/domain/repositories/message.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PostgresMessageRepository implements MessageRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private reconstitute(row: {
    id: string;
    reservationId: string;
    senderId: string;
    body: string;
    sentAt: Date;
  }): Message {
    return new Message({
      id: row.id,
      reservationId: row.reservationId,
      senderId: row.senderId,
      body: row.body,
      sentAt: row.sentAt,
    });
  }

  async save(message: Message): Promise<Message> {
    const row = await this.prisma.message.create({
      data: {
        id: message.id,
        reservationId: message.reservationId,
        senderId: message.senderId,
        body: message.body,
        sentAt: message.sentAt,
      },
    });
    return this.reconstitute(row);
  }

  async findByReservation(
    reservationId: string,
    after?: Date,
  ): Promise<Message[]> {
    const rows = await this.prisma.message.findMany({
      where: {
        reservationId,
        ...(after ? { sentAt: { gt: after } } : {}),
      },
      orderBy: { sentAt: 'asc' },
    });
    return rows.map((r) => this.reconstitute(r));
  }
}
