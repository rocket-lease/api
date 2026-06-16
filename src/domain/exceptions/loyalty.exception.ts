import { DomainException } from './domain.exception';

export class LoyaltyProfileNotFoundException extends DomainException {
  constructor(conductorId: string) {
    super(`Loyalty profile for conductor ${conductorId} not found`);
  }
}

export class ExperienceAlreadyClaimedException extends DomainException {
  constructor(source: string, sourceId: string) {
    super(`Experience already claimed for ${source} ${sourceId}`);
  }
}
