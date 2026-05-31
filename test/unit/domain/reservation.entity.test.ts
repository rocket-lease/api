import {
  Reservation,
  HOLD_TTL_MS,
  computeBalanceDueAt,
  BALANCE_MIN_WINDOW_MS,
  BALANCE_OVERDUE_REASON,
} from '@/domain/entities/reservation.entity';
import {
  ContractNotAcceptedException,
  InvalidQrTokenException,
  InvalidReservationTransitionException,
  DepositNotAvailableException,
  BalanceNotDueException,
  BalanceOverdueException,
} from '@/domain/exceptions/reservation.exception';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';
import { randomUUID } from 'node:crypto';

function makeReservation(overrides: Partial<ConstructorParameters<typeof Reservation>[0]> = {}) {
  const now = new Date('2026-06-01T10:00:00Z');
  return new Reservation({
    vehicleId: randomUUID(),
    conductorId: randomUUID(),
    rentadorId: randomUUID(),
    startAt: new Date('2026-06-02T10:00:00Z'),
    endAt: new Date('2026-06-04T10:00:00Z'),
    holdExpiresAt: new Date(now.getTime() + HOLD_TTL_MS),
    totalCents: 100000,
    contractAcceptedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('Reservation entity', () => {
  it('creates a pending_payment reservation with defaults', () => {
    const r = makeReservation();
    expect(r.getStatus()).toBe('pending_payment');
    expect(r.getCurrency()).toBe('ARS');
    expect(r.getPaymentMethod()).toBeNull();
  });

  it('rejects endAt <= startAt', () => {
    const t = new Date('2026-06-01T10:00:00Z');
    expect(() =>
      makeReservation({ startAt: t, endAt: t }),
    ).toThrow(InvalidEntityDataException);
  });

  it('rejects negative totalCents', () => {
    expect(() => makeReservation({ totalCents: -1 })).toThrow(
      InvalidEntityDataException,
    );
  });

  describe('confirmPayment', () => {
    it('transitions to confirmed and clears hold', () => {
      const r = makeReservation();
      const now = new Date('2026-06-01T10:05:00Z');
      r.confirmPayment('credit_card', now);
      expect(r.getStatus()).toBe('confirmed');
      expect(r.getPaymentMethod()).toBe('credit_card');
      expect(r.getHoldExpiresAt()).toBeNull();
      expect(r.getPaidAt()).toEqual(now);
    });

    it('fails when not pending_payment', () => {
      const r = makeReservation();
      r.confirmPayment('credit_card', new Date('2026-06-01T10:05:00Z'));
      expect(() =>
        r.confirmPayment('credit_card', new Date()),
      ).toThrow(InvalidReservationTransitionException);
    });

    it('fails when contract not accepted', () => {
      const r = makeReservation({ contractAcceptedAt: null });
      expect(() =>
        r.confirmPayment('credit_card', new Date()),
      ).toThrow(ContractNotAcceptedException);
    });
  });

  describe('isHoldExpired', () => {
    it('returns true when hold past expiry on pending_payment', () => {
      const r = makeReservation();
      expect(
        r.isHoldExpired(new Date('2026-06-01T10:11:00Z')),
      ).toBe(true);
    });

    it('returns false before expiry', () => {
      const r = makeReservation();
      expect(r.isHoldExpired(new Date('2026-06-01T10:05:00Z'))).toBe(false);
    });

    it('returns false when not pending_payment', () => {
      const r = makeReservation();
      r.confirmPayment('credit_card', new Date('2026-06-01T10:05:00Z'));
      expect(r.isHoldExpired(new Date('2030-01-01T00:00:00Z'))).toBe(false);
    });
  });

  describe('markExpired', () => {
    it('transitions to expired', () => {
      const r = makeReservation();
      r.markExpired(new Date('2026-06-01T10:11:00Z'));
      expect(r.getStatus()).toBe('expired');
      expect(r.getHoldExpiresAt()).toBeNull();
    });

    it('fails when not pending_payment', () => {
      const r = makeReservation();
      r.confirmPayment('credit_card', new Date('2026-06-01T10:05:00Z'));
      expect(() => r.markExpired(new Date())).toThrow(
        InvalidReservationTransitionException,
      );
    });
  });

  describe('cancel', () => {
    it('transitions pending_payment to cancelled and clears hold', () => {
      const r = makeReservation();
      const now = new Date('2026-06-01T10:05:00Z');
      r.cancel(now);
      expect(r.getStatus()).toBe('cancelled');
      expect(r.getHoldExpiresAt()).toBeNull();
      expect(r.getUpdatedAt()).toEqual(now);
    });

    it('transitions pending_approval to cancelled and clears hold', () => {
      const r = makeReservation({ status: 'pending_approval' });
      const now = new Date('2026-06-01T10:05:00Z');
      r.cancel(now);
      expect(r.getStatus()).toBe('cancelled');
      expect(r.getHoldExpiresAt()).toBeNull();
      expect(r.getUpdatedAt()).toEqual(now);
    });

    it('transitions confirmed to cancelled', () => {
      const r = makeReservation();
      r.confirmPayment('credit_card', new Date('2026-06-01T10:05:00Z'));
      const now = new Date('2026-06-01T10:10:00Z');
      r.cancel(now);
      expect(r.getStatus()).toBe('cancelled');
      expect(r.getUpdatedAt()).toEqual(now);
    });

    it('fails when already cancelled', () => {
      const r = makeReservation();
      r.cancel(new Date('2026-06-01T10:05:00Z'));
      expect(() => r.cancel(new Date())).toThrow(
        InvalidReservationTransitionException,
      );
    });
  });

  describe('approve', () => {
    it('transitions pending_approval to pending_payment with fresh hold', () => {
      const r = makeReservation({ status: 'pending_approval' });
      const now = new Date('2026-06-01T10:30:00Z');
      r.approve(now);
      expect(r.getStatus()).toBe('pending_payment');
      expect(r.getHoldExpiresAt()).toEqual(new Date(now.getTime() + HOLD_TTL_MS));
      expect(r.getUpdatedAt()).toEqual(now);
    });

    it('fails when already pending_payment', () => {
      const r = makeReservation();
      expect(() => r.approve(new Date())).toThrow(
        InvalidReservationTransitionException,
      );
    });

    it('fails when confirmed', () => {
      const r = makeReservation();
      r.confirmPayment('credit_card', new Date('2026-06-01T10:05:00Z'));
      expect(() => r.approve(new Date())).toThrow(
        InvalidReservationTransitionException,
      );
    });
  });

  describe('reject', () => {
    it('transitions pending_approval to rejected with reason', () => {
      const r = makeReservation({ status: 'pending_approval' });
      const now = new Date('2026-06-01T10:30:00Z');
      r.reject('Fechas no disponibles', now);
      expect(r.getStatus()).toBe('rejected');
      expect(r.getRejectionReason()).toBe('Fechas no disponibles');
      expect(r.getHoldExpiresAt()).toBeNull();
    });

    it('persists null when reason is null or empty', () => {
      const r1 = makeReservation({ status: 'pending_approval' });
      r1.reject(null, new Date());
      expect(r1.getRejectionReason()).toBeNull();

      const r2 = makeReservation({ status: 'pending_approval' });
      r2.reject('', new Date());
      expect(r2.getRejectionReason()).toBeNull();
    });

    it('fails when not pending_approval', () => {
      const r = makeReservation();
      expect(() => r.reject('motivo', new Date())).toThrow(
        InvalidReservationTransitionException,
      );
    });
  });

  describe('confirmPickup', () => {
    it('transitions confirmed to in_progress and generates returnQrToken', () => {
      const r = makeReservation({ status: 'confirmed', voucherToken: randomUUID() });
      const now = new Date('2026-06-02T10:00:00Z');
      r.confirmPickup(now);
      expect(r.getStatus()).toBe('in_progress');
      expect(r.getStartedAt()).toEqual(now);
      expect(r.getReturnQrToken()).toBeTruthy();
    });

    it('fails when not confirmed', () => {
      const r = makeReservation({ status: 'in_progress' });
      expect(() => r.confirmPickup(new Date())).toThrow(InvalidReservationTransitionException);
    });

    it('fails when pending_payment', () => {
      const r = makeReservation();
      expect(() => r.confirmPickup(new Date())).toThrow(InvalidReservationTransitionException);
    });
  });

  describe('confirmReturn', () => {
    function makeInProgressWithToken() {
      const r = makeReservation({ status: 'confirmed', voucherToken: randomUUID() });
      r.confirmPickup(new Date('2026-06-02T10:00:00Z'));
      return r;
    }

    it('transitions in_progress to completed', () => {
      const r = makeInProgressWithToken();
      const token = r.getReturnQrToken()!;
      const now = new Date('2026-06-04T10:00:00Z');
      r.confirmReturn(token, now);
      expect(r.getStatus()).toBe('completed');
      expect(r.getCompletedAt()).toEqual(now);
    });

    it('fails when token does not match', () => {
      const r = makeInProgressWithToken();
      expect(() => r.confirmReturn(randomUUID(), new Date())).toThrow(InvalidQrTokenException);
    });

    it('fails when not in_progress', () => {
      const r = makeReservation({ status: 'confirmed', voucherToken: randomUUID() });
      expect(() => r.confirmReturn(randomUUID(), new Date())).toThrow(InvalidReservationTransitionException);
    });
  });

  describe('markApprovalExpired', () => {
    it('transitions pending_approval to expired and clears hold', () => {
      const r = makeReservation({ status: 'pending_approval' });
      const now = new Date('2026-06-02T10:30:00Z');
      r.markApprovalExpired(now);
      expect(r.getStatus()).toBe('expired');
      expect(r.getHoldExpiresAt()).toBeNull();
    });

    it('fails when pending_payment', () => {
      const r = makeReservation();
      expect(() => r.markApprovalExpired(new Date())).toThrow(
        InvalidReservationTransitionException,
      );
    });
  });

  // US-26 / US-30: seña + saldo
  describe('payDeposit', () => {
    it('transitions to pending_balance and records deposit + deadline', () => {
      const r = makeReservation({ depositPercentageSnapshot: 30 });
      const now = new Date('2026-06-01T10:05:00Z');
      r.payDeposit('credit_card', 30000, now);
      expect(r.getStatus()).toBe('pending_balance');
      expect(r.getDepositPaidCents()).toBe(30000);
      expect(r.getDepositPaidAt()).toEqual(now);
      expect(r.getBalanceCents()).toBe(70000);
      expect(r.getHoldExpiresAt()).toBeNull();
      expect(r.getBalanceDueAt()).not.toBeNull();
    });

    it('fails if the snapshot has no deposit configured', () => {
      const r = makeReservation({ depositPercentageSnapshot: null });
      expect(() => r.payDeposit('credit_card', 0, new Date())).toThrow(
        DepositNotAvailableException,
      );
    });

    it('requires the contract to be accepted', () => {
      const r = makeReservation({
        depositPercentageSnapshot: 30,
        contractAcceptedAt: null,
      });
      expect(() => r.payDeposit('credit_card', 30000, new Date())).toThrow(
        ContractNotAcceptedException,
      );
    });
  });

  describe('computeBalanceDueAt', () => {
    it('caps at 24h before start when start is near', () => {
      const now = new Date('2026-06-01T10:00:00Z');
      const startAt = new Date('2026-06-03T10:00:00Z'); // 48h ahead
      const due = computeBalanceDueAt(now, startAt);
      // 24h before start = 2026-06-02T10:00:00Z
      expect(due.toISOString()).toBe('2026-06-02T10:00:00.000Z');
    });

    it('never returns a deadline in the past (1h floor)', () => {
      const now = new Date('2026-06-01T10:00:00Z');
      const startAt = new Date('2026-06-01T11:00:00Z'); // 1h ahead → start-24h is past
      const due = computeBalanceDueAt(now, startAt);
      expect(due.getTime()).toBe(now.getTime() + BALANCE_MIN_WINDOW_MS);
    });
  });

  describe('payBalance', () => {
    function señada() {
      const r = makeReservation({ depositPercentageSnapshot: 30 });
      r.payDeposit('credit_card', 30000, new Date('2026-06-01T10:05:00Z'));
      return r;
    }

    it('transitions pending_balance → confirmed and issues a voucher', () => {
      const r = señada();
      const now = new Date('2026-06-01T11:00:00Z');
      r.payBalance('credit_card', now);
      expect(r.getStatus()).toBe('confirmed');
      expect(r.getPaidAt()).toEqual(now);
      expect(r.getVoucherToken()).not.toBeNull();
    });

    it('fails when not in pending_balance', () => {
      const r = makeReservation();
      expect(() => r.payBalance('credit_card', new Date())).toThrow(
        BalanceNotDueException,
      );
    });

    it('fails when the balance deadline has passed', () => {
      const r = señada();
      const past = new Date(r.getBalanceDueAt()!.getTime() + 1000);
      expect(() => r.payBalance('credit_card', past)).toThrow(
        BalanceOverdueException,
      );
    });
  });

  describe('expireOverdueBalance', () => {
    it('cancels a señada reservation with the overdue reason', () => {
      const r = makeReservation({ depositPercentageSnapshot: 30 });
      r.payDeposit('credit_card', 30000, new Date('2026-06-01T10:05:00Z'));
      r.expireOverdueBalance(new Date('2026-06-10T10:00:00Z'));
      expect(r.getStatus()).toBe('cancelled');
      expect(r.getRejectionReason()).toBe(BALANCE_OVERDUE_REASON);
    });

    it('fails when not in pending_balance', () => {
      const r = makeReservation();
      expect(() => r.expireOverdueBalance(new Date())).toThrow(
        InvalidReservationTransitionException,
      );
    });
  });
});
