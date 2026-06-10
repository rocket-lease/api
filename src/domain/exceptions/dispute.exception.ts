import { DomainException } from './domain.exception';

export class DisputeNotFoundException extends DomainException {
  constructor() {
    super('dispute resolution not found');
  }
}

export class DisputeAlreadyRuledException extends DomainException {
  constructor() {
    super('dispute resolution already has a final verdict and cannot be ruled again');
  }
}

export class DisputeAppealLimitReachedException extends DomainException {
  constructor() {
    super('this dispute resolution has already been appealed once');
  }
}

export class DisputeInvalidPenaltyException extends DomainException {
  constructor(message = 'penalty amount/percentage is invalid or the responsible user is not part of the reservation') {
    super(message);
  }
}
