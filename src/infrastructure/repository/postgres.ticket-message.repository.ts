import { Injectable, Inject } from '@nestjs/common';
import { TicketMessage } from '@/domain/entities/ticket-message.entity';
import type { TicketMessageRepository } from '@/domain/repositories/ticket-message.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PostgresTicketMessageRepository implements TicketMessageRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private reconstitute(row: {
    id: string;
    ticketId: string;
    senderId: string;
    channelParticipantId: string;
    messageType: string;
    body: string;
    sentAt: Date;
  }): TicketMessage {
    return new TicketMessage({
      id: row.id,
      ticketId: row.ticketId,
      senderId: row.senderId,
      channelParticipantId: row.channelParticipantId,
      messageType: row.messageType as 'user' | 'info_request',
      body: row.body,
      sentAt: row.sentAt,
    });
  }

  async save(message: TicketMessage): Promise<TicketMessage> {
    const row = await this.prisma.ticketMessage.create({
      data: {
        id: message.id,
        ticketId: message.ticketId,
        senderId: message.senderId,
        channelParticipantId: message.channelParticipantId,
        messageType: message.messageType,
        body: message.body,
        sentAt: message.sentAt,
      },
    });
    return this.reconstitute(row);
  }

  async findByChannel(ticketId: string, channelParticipantId: string, after?: Date): Promise<TicketMessage[]> {
    const rows = await this.prisma.ticketMessage.findMany({
      where: {
        ticketId,
        channelParticipantId,
        ...(after ? { sentAt: { gt: after } } : {}),
      },
      orderBy: [{ sentAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => this.reconstitute(r));
  }
}
