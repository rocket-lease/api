import { DomainException } from './domain.exception';

export class InvalidMapBoundsException extends DomainException {
  constructor(message: string) {
    super(`Invalid map bounds: ${message}`);
  }
}

export class VehicleLocationRequiredException extends DomainException {
  constructor() {
    super('Vehicle latitude, longitude and address are required');
  }
}
