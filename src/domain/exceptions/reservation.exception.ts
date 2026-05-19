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
  constructor(token: string) {
    super(`QR token ${token} is not valid for this operation`);
  }
}
