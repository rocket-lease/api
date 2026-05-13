export abstract class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EntityAlreadyExistsException extends DomainException {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} already exists`);
  }
}

export class EntityNotFoundException extends DomainException {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`);
  }
}

export class InvalidEntityDataException extends DomainException {
  constructor(message: string) {
    super(`Validation error: ${message}`);
  }
}

export class FavoriteAlreadyExistsException extends DomainException {
  constructor(vehicleId: string) {
    super(`favorite for vehicle ${vehicleId} already exists`);
  }
}

export class FavoriteNotFoundException extends DomainException {
  constructor(vehicleId: string) {
    super(`favorite for vehicle ${vehicleId} not found`);
  }
}
