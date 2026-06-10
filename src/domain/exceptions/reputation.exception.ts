import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class UserSuspendedException extends DomainException {
  constructor(userId: string) {
    super(`User ${userId} is suspended due to poor reputation.`);
    this.name = 'UserSuspendedException';
  }
}

export class PenaltyAlreadyAppliedException extends DomainException {
  constructor(ticketId: string) {
    super(`Penalty for ticket ${ticketId} has already been applied.`);
    this.name = 'PenaltyAlreadyAppliedException';
  }
}
