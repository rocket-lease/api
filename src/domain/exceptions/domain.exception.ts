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

export class EmailNotVerifiedException extends DomainException {
  constructor(email: string) {
    super(`email ${email} is not verified`);
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

export class UserHasVehiclesException extends DomainException {
  constructor() {
    super('User has active vehicles and cannot be deleted');
  }
}

export class UserHasActiveReservationsException extends DomainException {
  constructor() {
    super('User has active reservations and cannot delete their account');
  }
}

export class EmailUnverifiedPendingException extends DomainException {
  constructor(email: string) {
    super(`email ${email} is already registered but pending verification`);
  }
}

export class BankAccountRequiredException extends DomainException {
  constructor() {
    super('user must link a bank account');
  }
}

export class IdentityVerificationRequiredException extends DomainException {
  constructor() {
    super('identity verification is required to continue');
  }
}

export class DriverLicenseVerificationRequiredException extends DomainException {
  constructor() {
    super('driver license verification is required to continue');
  }
}
/**
 * El % de seña configurado en un set de reglas está fuera del rango
 * aceptado (10-50) o tiene formato inválido. Mapea a 400
 * `DEPOSIT_PERCENTAGE_OUT_OF_RANGE`.
 */
export class DepositPercentageOutOfRangeException extends DomainException {
  constructor(value: number) {
    super(
      `deposit percentage must be an integer between 10 and 50 or null (got ${value})`,
    );
  }
}

/**
 * Se intentó modificar el `vehicleId` de un set existente. El scope
 * (compartido vs privado) es inmutable post-creación. Mapea a 400
 * `RULESET_VEHICLE_ID_IMMUTABLE`.
 */
export class RuleSetVehicleIdImmutableException extends DomainException {
  constructor() {
    super('vehicleId of a reservation rule set cannot be changed after creation');
  }
}

/**
 * Se buscó un set por id pero pertenece a otro rentador. Mapea a 404
 * `RULESET_NOT_FOUND_FOR_OWNER` (404 desambiguado, no 403, para no
 * filtrar existencia de sets ajenos).
 */
export class RuleSetNotFoundForOwnerException extends DomainException {
  constructor(ruleSetId: string) {
    super(`reservation rule set ${ruleSetId} not found for current owner`);
  }
}

/**
 * Se intentó asignar un set privado a un vehículo distinto al suyo. Mapea
 * a 400 `RULESET_PRIVATE_CANNOT_BE_SHARED`.
 */
export class RuleSetPrivateCannotBeSharedException extends DomainException {
  constructor() {
    super('private reservation rule sets cannot be assigned to other vehicles');
  }
}

/**
 * Se intentó crear un segundo set privado para un vehículo que ya tiene uno
 * asignado. Cada vehículo puede tener como máximo un set privado activo
 * (UNIQUE constraint en DB). Mapea a 409 `VEHICLE_ALREADY_HAS_PRIVATE_RULESET`.
 */
export class VehicleAlreadyHasPrivateRuleSetException extends DomainException {
  constructor(vehicleId: string) {
    super(`vehicle ${vehicleId} already has a private reservation rule set`);
  }
}

/**
 * Se buscó la verificación documental de un vehículo pero no existe.
 * Mapea a 404 `VEHICLE_DOCUMENT_NOT_FOUND`.
 */
export class VehicleDocumentNotFoundException extends DomainException {
  constructor(vehicleId: string) {
    super(`vehicle document verification for vehicle ${vehicleId} not found`);
  }
}

/**
 * El vehículo ya tiene documentos subidos y está pendiente de verificación.
 * Mapea a 409 `VEHICLE_DOCUMENTS_ALREADY_PENDING`.
 */
export class VehicleDocumentsAlreadyPendingException extends DomainException {
  constructor(vehicleId: string) {
    super(`vehicle ${vehicleId} already has documents pending verification`);
  }
}
