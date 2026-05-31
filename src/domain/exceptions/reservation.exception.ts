import { DomainException } from './domain.exception';

export class ReservationNotFoundException extends DomainException {
  constructor(reservationId: string) {
    super(`reservation ${reservationId} not found`);
  }
}

export class VehicleNotAvailableException extends DomainException {
  constructor(vehicleId: string) {
    super(`vehicle ${vehicleId} is not available for the requested dates`);
  }
}

export class HoldExpiredException extends DomainException {
  constructor(reservationId: string) {
    super(`hold expired for reservation ${reservationId}`);
  }
}

export class InvalidReservationTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(`invalid reservation transition: ${from} -> ${to}`);
  }
}

export class ContractNotAcceptedException extends DomainException {
  constructor() {
    super('contract must be accepted before confirming the reservation');
  }
}

export class ReservationForbiddenException extends DomainException {
  constructor() {
    super('forbidden: this reservation does not belong to the current user');
  }
}

export class OwnerCannotReserveOwnVehicleException extends DomainException {
  constructor(vehicleId: string) {
    super(`owner cannot reserve own vehicle ${vehicleId}`);
  }
}

export class TransferExpiredException extends DomainException {
  constructor(reservationId: string) {
    super(`transfer expired for reservation ${reservationId}`);
  }
}

export class VoucherNotFoundException extends DomainException {
  constructor(token: string) {
    super(`voucher with token ${token} not found`);
  }
}

export class VoucherReservationCancelledException extends DomainException {
  constructor(reservationId: string) {
    super(`reservation ${reservationId} is cancelled — voucher is invalid`);
  }
}

export class InvalidQrTokenException extends DomainException {
  constructor() {
    super('QR token is not valid for this operation');
  }
}

export class ExtensionParentNotInProgressException extends DomainException {
  constructor(reservationId: string) {
    super(`reservation ${reservationId} must be in_progress to be extended`);
  }
}

export class ExtensionInvalidEndAtException extends DomainException {
  constructor(message: string) {
    super(`invalid extension endAt: ${message}`);
  }
}

export class PendingExtensionExistsException extends DomainException {
  constructor(reservationId: string) {
    super(
      `reservation ${reservationId} already has a pending extension request`,
    );
  }
}

export class ExtensionNotPendingException extends DomainException {
  constructor(reservationId: string) {
    super(`extension ${reservationId} is not pending and cannot be modified`);
  }
}

export class DepositNotAvailableException extends DomainException {
  constructor(reservationId: string) {
    super(`reservation ${reservationId} does not allow paying a deposit`);
  }
}

export class BalanceNotDueException extends DomainException {
  constructor(reservationId: string) {
    super(`reservation ${reservationId} has no balance pending payment`);
  }
}

export class BalanceOverdueException extends DomainException {
  constructor(reservationId: string) {
    super(`balance payment deadline has passed for reservation ${reservationId}`);
  }
}

export class VehicleHomeDeliveryNotEnabledException extends DomainException {
  constructor(vehicleId: string) {
    super(`vehicle ${vehicleId} does not have home delivery enabled`);
  }
}

export class VehicleHomeReturnNotEnabledException extends DomainException {
  constructor(vehicleId: string) {
    super(`vehicle ${vehicleId} does not have home return enabled`);
  }
}

export class HomeDeliveryAddressRequiredException extends DomainException {
  constructor() {
    super('delivery address is required when home delivery is requested');
  }
}

export class HomeReturnAddressRequiredException extends DomainException {
  constructor() {
    super('return address is required when home return is requested');
  }
}
