import { Inject, Injectable } from '@nestjs/common';
import {
  type SendTicketMessageRequest,
  type SendTicketMessageResponse,
  SendTicketMessageResponseSchema,
  type ListTicketMessagesResponse,
  ListTicketMessagesResponseSchema,
} from '@rocket-lease/contracts';
import { Ticket } from '@/domain/entities/ticket.entity';
import { TicketMessage } from '@/domain/entities/ticket-message.entity';
import { TicketMessageNotAllowedException } from '@/domain/exceptions/ticket.exception';
import { ReservationForbiddenException } from '@/domain/exceptions/reservation.exception';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';
import type { TicketRepository } from '@/domain/repositories/ticket.repository';
import { TICKET_REPOSITORY } from '@/domain/repositories/ticket.repository';
import type { TicketMessageRepository } from '@/domain/repositories/ticket-message.repository';
import { TICKET_MESSAGE_REPOSITORY } from '@/domain/repositories/ticket-message.repository';
import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import type { NotificationProvider } from '@/domain/providers/notification.provider';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';

const CLOSED_TICKET_STATUSES = new Set(['resolved', 'rejected']);

@Injectable()
export class TicketMessageService {
  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: TicketRepository,
    @Inject(TICKET_MESSAGE_REPOSITORY)
    private readonly ticketMessageRepo: TicketMessageRepository,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: UserRepository,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
  ) {}

  private async getParties(ticket: Ticket): Promise<{ reporterId: string; counterpartId: string | null }> {
    const reporterId = ticket.getReporterId();
    if (!ticket.getReservationId() || !ticket.getReportedBy()) {
      return { reporterId, counterpartId: null };
    }
    const reservation = await this.reservationRepo.findById(ticket.getReservationId() as string);
    if (!reservation) return { reporterId, counterpartId: null };
    const counterpartId = ticket.getReportedBy() === 'conductor'
      ? reservation.getRentadorId()
      : reservation.getConductorId();
    return { reporterId, counterpartId };
  }

  private async resolveAccess(
    callerId: string,
    ticketId: string,
  ): Promise<{ ticket: Ticket; isAdmin: boolean; channelParticipantId: string }> {
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);
    const { reporterId, counterpartId } = await this.getParties(ticket);
    const caller = await this.userRepo.findById(callerId);
    const isAdmin = caller?.getIsAdmin() ?? false;

    const isReporter = callerId === reporterId;
    const isCounterpart = counterpartId !== null && callerId === counterpartId;

    if (!isReporter && !isCounterpart && !isAdmin) {
      throw new ReservationForbiddenException();
    }

    // Non-admin: channel is always their own ID
    // Admin: channel must be supplied via dto (validated in sendMessage/listMessages)
    const channelParticipantId = isAdmin ? '' : callerId;

    return { ticket, isAdmin, channelParticipantId };
  }

  async sendMessage(
    callerId: string,
    ticketId: string,
    dto: SendTicketMessageRequest,
  ): Promise<SendTicketMessageResponse> {
    const { ticket, isAdmin, channelParticipantId: derivedChannel } = await this.resolveAccess(callerId, ticketId);

    if (CLOSED_TICKET_STATUSES.has(ticket.getStatus())) {
      throw new TicketMessageNotAllowedException();
    }

    const channelParticipantId = isAdmin
      ? (dto.channelParticipantId ?? (() => { throw new InvalidEntityDataException('admin must supply channelParticipantId'); })())
      : derivedChannel;

    const message = new TicketMessage({
      ticketId: ticket.getId(),
      senderId: callerId,
      channelParticipantId,
      messageType: 'user',
      body: dto.body,
    });
    const saved = await this.ticketMessageRepo.save(message);

    // Notify: if admin sent, notify the channel participant; if party sent, notify admin
    const { reporterId } = await this.getParties(ticket);
    const recipientId = isAdmin ? channelParticipantId : reporterId;
    if (recipientId !== callerId) {
      void this.notificationProvider.notify(
        recipientId,
        'Nuevo mensaje de soporte',
        dto.body.length > 80 ? dto.body.slice(0, 77) + '...' : dto.body,
        { url: `/soporte/tickets/${ticket.getId()}` },
      );
    }

    return this.toResponse(saved);
  }

  async listMessages(
    callerId: string,
    ticketId: string,
    channelParticipantId?: string,
    after?: Date,
  ): Promise<ListTicketMessagesResponse> {
    const { ticket, isAdmin, channelParticipantId: derivedChannel } = await this.resolveAccess(callerId, ticketId);

    const channel = isAdmin
      ? (channelParticipantId ?? (() => { throw new InvalidEntityDataException('admin must supply party query param'); })())
      : derivedChannel;

    const messages = await this.ticketMessageRepo.findByChannel(ticket.getId(), channel, after);
    return ListTicketMessagesResponseSchema.parse({
      items: messages.map((m) => this.toResponse(m)),
    });
  }

  async saveInfoRequestMessage(
    ticketId: string,
    adminId: string,
    channelParticipantId: string,
    body: string,
  ): Promise<void> {
    const message = new TicketMessage({
      ticketId,
      senderId: adminId,
      channelParticipantId,
      messageType: 'info_request',
      body,
    });
    await this.ticketMessageRepo.save(message);
  }

  private toResponse(m: TicketMessage): SendTicketMessageResponse {
    return SendTicketMessageResponseSchema.parse({
      id: m.id,
      ticketId: m.ticketId,
      senderId: m.senderId,
      channelParticipantId: m.channelParticipantId,
      messageType: m.messageType,
      body: m.body,
      sentAt: m.sentAt.toISOString(),
    });
  }
}
