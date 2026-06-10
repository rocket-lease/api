import { randomUUID } from 'node:crypto';
import { InvalidEntityDataException } from '../exceptions/domain.exception';
import {
  DisputeAlreadyRuledException,
  DisputeAppealLimitReachedException,
} from '../exceptions/dispute.exception';

export type DisputeStatus = 'escalated' | 'awaiting_info' | 'ruled' | 'appealed' | 'closed';
export type PenaltyType = 'fixed' | 'percentage';

export interface DisputePenalty {
  type: PenaltyType;
  amountCents: number | null;
  percentage: number | null;
}

export interface DisputeResolutionProps {
  id?: string;
  ticketId: string;
  status?: DisputeStatus;
  moderatorId: string | null;
  infoRequestedAt?: Date | null;
  infoDeadlineAt?: Date | null;
  verdict?: string | null;
  responsibleUserId?: string | null;
  penaltyType?: PenaltyType | null;
  penaltyAmountCents?: number | null;
  penaltyPercentage?: number | null;
  ruledAt?: Date | null;
  appealCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const INFO_DEADLINE_HOURS = 48;
const APPEAL_LIMIT = 1;

export class DisputeResolution {
  private constructor(private readonly props: Required<DisputeResolutionProps>) {}

  static escalate(ticketId: string, moderatorId: string): DisputeResolution {
    const now = new Date();
    return new DisputeResolution({
      id: randomUUID(),
      ticketId,
      status: 'escalated',
      moderatorId,
      infoRequestedAt: null,
      infoDeadlineAt: null,
      verdict: null,
      responsibleUserId: null,
      penaltyType: null,
      penaltyAmountCents: null,
      penaltyPercentage: null,
      ruledAt: null,
      appealCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: Required<DisputeResolutionProps>): DisputeResolution {
    return new DisputeResolution(props);
  }

  requestInfo(message: string, now: Date = new Date()): DisputeResolution {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new InvalidEntityDataException('info request message cannot be empty');
    }
    const deadline = new Date(now.getTime() + INFO_DEADLINE_HOURS * 60 * 60 * 1000);
    return new DisputeResolution({
      ...this.props,
      status: 'awaiting_info',
      infoRequestedAt: now,
      infoDeadlineAt: deadline,
      updatedAt: now,
    });
  }

  rule(
    verdict: string,
    responsibleUserId: string | null,
    penalty: DisputePenalty | null,
    now: Date = new Date(),
  ): DisputeResolution {
    if (this.props.status === 'closed') {
      throw new DisputeAlreadyRuledException();
    }
    const trimmed = verdict.trim();
    if (!trimmed) {
      throw new InvalidEntityDataException('verdict cannot be empty');
    }
    return new DisputeResolution({
      ...this.props,
      status: 'ruled',
      verdict: trimmed,
      responsibleUserId,
      penaltyType: penalty?.type ?? null,
      penaltyAmountCents: penalty?.amountCents ?? null,
      penaltyPercentage: penalty?.percentage ?? null,
      ruledAt: now,
      updatedAt: now,
    });
  }

  appeal(now: Date = new Date()): DisputeResolution {
    if (this.props.appealCount >= APPEAL_LIMIT) {
      throw new DisputeAppealLimitReachedException();
    }
    return new DisputeResolution({
      ...this.props,
      status: 'appealed',
      appealCount: this.props.appealCount + 1,
      updatedAt: now,
    });
  }

  close(now: Date = new Date()): DisputeResolution {
    return new DisputeResolution({
      ...this.props,
      status: 'closed',
      updatedAt: now,
    });
  }

  getId() { return this.props.id; }
  getTicketId() { return this.props.ticketId; }
  getStatus() { return this.props.status; }
  getModeratorId() { return this.props.moderatorId; }
  getInfoRequestedAt() { return this.props.infoRequestedAt; }
  getInfoDeadlineAt() { return this.props.infoDeadlineAt; }
  getVerdict() { return this.props.verdict; }
  getResponsibleUserId() { return this.props.responsibleUserId; }
  getPenaltyType() { return this.props.penaltyType; }
  getPenaltyAmountCents() { return this.props.penaltyAmountCents; }
  getPenaltyPercentage() { return this.props.penaltyPercentage; }
  getRuledAt() { return this.props.ruledAt; }
  getAppealCount() { return this.props.appealCount; }
  getCreatedAt() { return this.props.createdAt; }
  getUpdatedAt() { return this.props.updatedAt; }
}
