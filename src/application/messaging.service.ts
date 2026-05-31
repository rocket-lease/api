import { Inject, Injectable } from '@nestjs/common';
import {
  type SendMessageRequest,
  type SendMessageResponse,
  SendMessageResponseSchema,
  type ListMessagesResponse,
  ListMessagesResponseSchema,
} from '@rocket-lease/contracts';
import { Message } from '@/domain/entities/message.entity';
import { ChatNotAllowedException } from '@/domain/exceptions/messaging.exception';
import {
  ReservationForbiddenException,
  ReservationNotFoundException,
} from '@/domain/exceptions/reservation.exception';
import type { MessageRepository } from '@/domain/repositories/message.repository';
import { MESSAGE_REPOSITORY } from '@/domain/repositories/message.repository';
import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';
import type { NotificationProvider } from '@/domain/providers/notification.provider';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';

const CHAT_ALLOWED_STATUSES = new Set(['confirmed', 'in_progress']);

@Injectable()
export class MessagingService {
  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepo: MessageRepository,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepository,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
  ) {}

  private async resolveAndAuthorize(callerId: string, reservationId: string) {
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);

    const isConductor = reservation.getConductorId() === callerId;
    const isRentador = reservation.getRentadorId() === callerId;
    if (!isConductor && !isRentador) throw new ReservationForbiddenException();

    if (!CHAT_ALLOWED_STATUSES.has(reservation.getStatus())) {
      throw new ChatNotAllowedException();
    }

    return { reservation, isConductor };
  }

  async sendMessage(
    callerId: string,
    reservationId: string,
    dto: SendMessageRequest,
  ): Promise<SendMessageResponse> {
    const { reservation, isConductor } = await this.resolveAndAuthorize(
      callerId,
      reservationId,
    );

    const message = new Message({
      reservationId,
      senderId: callerId,
      body: dto.body,
    });
    const saved = await this.messageRepo.save(message);

    const recipientId = isConductor
      ? reservation.getRentadorId()
      : reservation.getConductorId();
    await this.notificationProvider.notify(
      recipientId,
      'Nuevo mensaje',
      'Tenés un nuevo mensaje sobre tu reserva.',
      { url: `/reservas/${reservationId}/chat` },
    );

    return SendMessageResponseSchema.parse({
      id: saved.id,
      reservationId: saved.reservationId,
      senderId: saved.senderId,
      body: saved.body,
      sentAt: saved.sentAt.toISOString(),
    });
  }

  async listMessages(
    callerId: string,
    reservationId: string,
    after?: Date,
  ): Promise<ListMessagesResponse> {
    await this.resolveAndAuthorize(callerId, reservationId);
    const messages = await this.messageRepo.findByReservation(
      reservationId,
      after,
    );
    return ListMessagesResponseSchema.parse({
      items: messages.map((m) => ({
        id: m.id,
        reservationId: m.reservationId,
        senderId: m.senderId,
        body: m.body,
        sentAt: m.sentAt.toISOString(),
      })),
    });
  }
}
