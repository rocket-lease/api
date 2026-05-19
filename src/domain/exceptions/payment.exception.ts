import { DomainException } from './domain.exception';

export class TransferExpiredException extends DomainException {
  constructor(reservationId: string) {
    super(`transfer expired for reservation ${reservationId}`);
  }
}

export class UnsupportedPaymentMethodException extends DomainException {
  constructor(method: string) {
    super(`unsupported payment method: ${method}`);
  }
}

export class PaymentNotFoundException extends DomainException {
  constructor(reservationId: string) {
    super(`payment for reservation ${reservationId} not found`);
  }
}
