import { DomainException } from './domain.exception';

export class InvalidWithdrawAmountException extends DomainException {
  constructor() {
    super('withdraw amount must be greater than 0');
  }
}

export class InsufficientBalanceException extends DomainException {
  constructor() {
    super('insufficient balance');
  }
}