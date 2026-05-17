import {
  Reservation,
  HOLD_TTL_MS,
} from '@/domain/entities/reservation.entity';
import {
  ContractNotAcceptedException,
  InvalidReservationTransitionException,
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

    it('fails when confirmed', () => {
      const r = makeReservation();
      r.confirmPayment('credit_card', new Date('2026-06-01T10:05:00Z'));
      expect(() => r.cancel(new Date())).toThrow(
        InvalidReservationTransitionException,
      );
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
});
