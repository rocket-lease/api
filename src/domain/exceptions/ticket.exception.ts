import { DomainException } from './domain.exception';

export class TicketNotFoundException extends DomainException {
  constructor() {
    super('ticket not found');
  }
}

export class TicketAlreadyExistsException extends DomainException {
  constructor() {
    super('ticket already exists for this reservation and reporter');
  }
}

export class TicketReservationInvalidStatusException extends DomainException {
  constructor() {
    super('tickets can only be created for reservations in_progress or completed');
  }
}

export class TicketRatingNotAllowedException extends DomainException {
  constructor() {
    super('ticket can only be rated once it is resolved or rejected');
  }
}

export class TicketAlreadyRatedException extends DomainException {
  constructor() {
    super('ticket has already been rated');
  }
}

export class TicketMessageNotAllowedException extends DomainException {
  constructor() {
    super('messages are not allowed on a closed ticket');
  }
}

export class TicketAlreadyClosedException extends DomainException {
  constructor() {
    super('ticket is already resolved or closed');
  }
}

export class TicketInvalidTransitionException extends DomainException {
  constructor() {
    super('ticket cannot transition to under_review from its current status');
  }
}

export class TicketResolutionImpactException extends DomainException {
  constructor(reason: string) {
    super(`invalid ticket resolution impact: ${reason}`);
  }
}
