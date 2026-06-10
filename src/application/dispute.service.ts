import { Inject, Injectable } from '@nestjs/common';
import {
  type RequestDisputeInfoRequest,
  type IssueDisputeVerdictRequest,
  type AppealDisputeRequest,
  type DisputeResolutionResponse,
  DisputeResolutionResponseSchema,
} from '@rocket-lease/contracts';
import { DisputeResolution, type DisputePenalty } from '@/domain/entities/dispute-resolution.entity';
import { Ticket } from '@/domain/entities/ticket.entity';
import {
  DisputeInvalidPenaltyException,
  DisputeNotFoundException,
} from '@/domain/exceptions/dispute.exception';
import {
  AdminAccessRequiredException,
  EntityAlreadyExistsException,
  InvalidEntityDataException,
} from '@/domain/exceptions/domain.exception';
import { ReservationForbiddenException, ReservationNotFoundException } from '@/domain/exceptions/reservation.exception';
import type { DisputeResolutionRepository } from '@/domain/repositories/dispute-resolution.repository';
import { DISPUTE_RESOLUTION_REPOSITORY } from '@/domain/repositories/dispute-resolution.repository';
import type { TicketRepository } from '@/domain/repositories/ticket.repository';
import { TICKET_REPOSITORY } from '@/domain/repositories/ticket.repository';
import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import type { NotificationProvider } from '@/domain/providers/notification.provider';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';
import { WalletService } from '@/application/wallet.service';
import { TicketMessageService } from '@/application/ticket-message.service';

const DISPUTABLE_TICKET_TYPE = 'counterpart_report';
const REPUTATION_PENALTY_POINTS = 0.5;

@Injectable()
export class DisputeService {
  constructor(
    @Inject(DISPUTE_RESOLUTION_REPOSITORY)
    private readonly disputeRepo: DisputeResolutionRepository,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: TicketRepository,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: ReservationRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: UserRepository,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
    @Inject(WalletService)
    private readonly walletService: WalletService,
    @Inject(TicketMessageService)
    private readonly ticketMessageService: TicketMessageService,
  ) {}

  private async assertAdmin(callerId: string): Promise<void> {
    const user = await this.userRepo.findById(callerId);
    if (!user || !user.getIsAdmin()) {
      throw new AdminAccessRequiredException();
    }
  }

  private async getParties(ticket: Ticket): Promise<{ conductorId: string; rentadorId: string }> {
    const reservationId = ticket.getReservationId();
    if (!reservationId) throw new InvalidEntityDataException('ticket has no associated reservation');
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    return { conductorId: reservation.getConductorId(), rentadorId: reservation.getRentadorId() };
  }

  async findByTicketId(
    adminId: string,
    ticketId: string,
  ): Promise<DisputeResolutionResponse | null> {
    await this.assertAdmin(adminId);
    const dispute = await this.disputeRepo.findByTicketId(ticketId);
    if (!dispute) return null;
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);
    const parties = await this.getParties(ticket);
    return this.toResponse(dispute, parties);
  }

  async escalate(adminId: string, ticketId: string): Promise<DisputeResolutionResponse> {
    await this.assertAdmin(adminId);
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);
    if (ticket.getType() !== DISPUTABLE_TICKET_TYPE) {
      throw new InvalidEntityDataException('only counterpart_report tickets can be escalated to a dispute');
    }

    const existing = await this.disputeRepo.findByTicketId(ticket.getId());
    if (existing) throw new EntityAlreadyExistsException('DisputeResolution', ticket.getId());

    const dispute = DisputeResolution.escalate(ticket.getId(), adminId);
    const saved = await this.disputeRepo.save(dispute);

    const updatedTicket = ticket.withStatus('under_review');
    await this.ticketRepo.save(updatedTicket);

    const { conductorId, rentadorId } = await this.getParties(ticket);
    for (const partyId of [conductorId, rentadorId]) {
      void this.notificationProvider.notify(
        partyId,
        'Tu caso fue escalado a disputa',
        `El reporte "${ticket.getSubject()}" fue escalado para una resolución formal.`,
        { url: `/soporte/tickets/${ticket.getId()}` },
      );
    }

    return this.toResponse(saved, { conductorId, rentadorId });
  }

  async requestInfo(
    adminId: string,
    ticketId: string,
    dto: RequestDisputeInfoRequest,
  ): Promise<DisputeResolutionResponse> {
    await this.assertAdmin(adminId);
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);
    const dispute = await this.disputeRepo.findByTicketId(ticket.getId());
    if (!dispute) throw new DisputeNotFoundException();

    const { conductorId, rentadorId } = await this.getParties(ticket);
    const validParticipants = new Set([conductorId, rentadorId]);
    if (!validParticipants.has(dto.targetParticipantId)) {
      throw new InvalidEntityDataException('targetParticipantId must be one of the parties in the dispute');
    }

    const updated = dispute.requestInfo(dto.message);
    const saved = await this.disputeRepo.save(updated);

    await this.ticketMessageService.saveInfoRequestMessage(
      ticket.getId(),
      adminId,
      dto.targetParticipantId,
      dto.message,
    );

    void this.notificationProvider.notify(
      dto.targetParticipantId,
      'El moderador te solicitó información adicional',
      dto.message.length > 80 ? dto.message.slice(0, 77) + '...' : dto.message,
      { url: `/soporte/tickets/${ticket.getId()}` },
    );

    return this.toResponse(saved, { conductorId, rentadorId });
  }

  private resolvePenaltyAmount(
    penalty: { type: 'fixed' | 'percentage'; amountCents?: number | null; percentage?: number | null },
    totalCents: number,
  ): number {
    if (penalty.type === 'fixed') {
      if (penalty.amountCents === null || penalty.amountCents === undefined) {
        throw new DisputeInvalidPenaltyException();
      }
      return penalty.amountCents;
    }
    if (penalty.percentage === null || penalty.percentage === undefined) {
      throw new DisputeInvalidPenaltyException();
    }
    return Math.round((totalCents * penalty.percentage) / 100);
  }

  async issueVerdict(
    adminId: string,
    ticketId: string,
    dto: IssueDisputeVerdictRequest,
  ): Promise<DisputeResolutionResponse> {
    await this.assertAdmin(adminId);
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);
    const dispute = await this.disputeRepo.findByTicketId(ticket.getId());
    if (!dispute) throw new DisputeNotFoundException();

    const { conductorId, rentadorId } = await this.getParties(ticket);

    let penalty: DisputePenalty | null = null;
    if (dto.penalty) {
      if (!dto.responsibleUserId) throw new DisputeInvalidPenaltyException();
      const isConductorResponsible = dto.responsibleUserId === conductorId;
      const isRentadorResponsible = dto.responsibleUserId === rentadorId;
      if (!isConductorResponsible && !isRentadorResponsible) {
        throw new DisputeInvalidPenaltyException();
      }

      const reservationId = ticket.getReservationId();
      if (!reservationId) throw new DisputeInvalidPenaltyException();
      const reservation = await this.reservationRepo.findById(reservationId);
      if (!reservation) throw new DisputeInvalidPenaltyException();

      const amountCents = this.resolvePenaltyAmount(dto.penalty, reservation.getTotalCents());
      penalty = {
        type: dto.penalty.type,
        amountCents: dto.penalty.type === 'fixed' ? amountCents : null,
        percentage: dto.penalty.type === 'percentage' ? (dto.penalty.percentage ?? null) : null,
      };

      const perjudicadoUserId = isConductorResponsible ? rentadorId : conductorId;

      await this.walletService.applyDisputePenalty({
        disputeResolutionId: dispute.getId(),
        responsibleUserId: dto.responsibleUserId,
        perjudicadoUserId,
        amountCents,
      });
      await this.userRepo.applyReputationPenalty(dto.responsibleUserId, -REPUTATION_PENALTY_POINTS);
    }

    const ruled = dispute.rule(dto.verdict, dto.responsibleUserId, penalty);
    const saved = await this.disputeRepo.save(ruled);

    const updatedTicket = ticket.withStatus(dto.responsibleUserId ? 'resolved' : 'rejected');
    await this.ticketRepo.save(updatedTicket);

    for (const partyId of [conductorId, rentadorId]) {
      void this.notificationProvider.notify(
        partyId,
        'Se emitió un fallo sobre tu disputa',
        'El moderador resolvió el caso. Podés apelar el fallo una vez si no estás de acuerdo.',
        { url: `/soporte/tickets/${ticket.getId()}` },
      );
    }

    return this.toResponse(saved, { conductorId, rentadorId });
  }

  async appeal(
    callerId: string,
    ticketId: string,
    _dto: AppealDisputeRequest,
  ): Promise<DisputeResolutionResponse> {
    const ticket = await this.ticketRepo.findByIdOrThrow(ticketId);
    const dispute = await this.disputeRepo.findByTicketId(ticket.getId());
    if (!dispute) throw new DisputeNotFoundException();

    const { conductorId, rentadorId } = await this.getParties(ticket);
    if (callerId !== conductorId && callerId !== rentadorId) {
      throw new ReservationForbiddenException();
    }

    const appealed = dispute.appeal();
    const saved = await this.disputeRepo.save(appealed);

    const updatedTicket = ticket.withStatus('under_review');
    await this.ticketRepo.save(updatedTicket);

    if (dispute.getModeratorId()) {
      void this.notificationProvider.notify(
        dispute.getModeratorId() as string,
        'Una disputa fue apelada',
        `El caso del ticket "${ticket.getSubject()}" fue apelado y requiere un nuevo fallo.`,
        { url: `/admin/tickets/${ticket.getId()}` },
      );
    }

    return this.toResponse(saved, { conductorId, rentadorId });
  }

  private toResponse(
    dispute: DisputeResolution,
    parties: { conductorId: string; rentadorId: string },
  ): DisputeResolutionResponse {
    return DisputeResolutionResponseSchema.parse({
      id: dispute.getId(),
      ticketId: dispute.getTicketId(),
      status: dispute.getStatus(),
      moderatorId: dispute.getModeratorId(),
      conductorId: parties.conductorId,
      rentadorId: parties.rentadorId,
      infoRequestedAt: dispute.getInfoRequestedAt()?.toISOString() ?? null,
      infoDeadlineAt: dispute.getInfoDeadlineAt()?.toISOString() ?? null,
      verdict: dispute.getVerdict(),
      responsibleUserId: dispute.getResponsibleUserId(),
      penaltyType: dispute.getPenaltyType(),
      penaltyAmountCents: dispute.getPenaltyAmountCents(),
      penaltyPercentage: dispute.getPenaltyPercentage(),
      ruledAt: dispute.getRuledAt()?.toISOString() ?? null,
      appealCount: dispute.getAppealCount(),
      createdAt: dispute.getCreatedAt().toISOString(),
      updatedAt: dispute.getUpdatedAt().toISOString(),
    });
  }
}
