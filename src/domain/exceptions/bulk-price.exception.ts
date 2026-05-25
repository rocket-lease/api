import { DomainException } from './domain.exception';

export class BulkPriceVehicleNotOwnedException extends DomainException {
  constructor() {
    super('one or more vehicles do not belong to the current owner');
  }
}

export class BulkPriceResultInvalidException extends DomainException {
  constructor(vehicleId: string) {
    super(`computed price for vehicle ${vehicleId} would be zero or negative`);
  }
}
