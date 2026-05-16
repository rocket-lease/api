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

  describe('cancelHold', () => {
    it('transitions pending_payment to cancelled', () => {
      const r = makeReservation();
      r.cancelHold(new Date('2026-06-01T10:05:00Z'));
      expect(r.getStatus()).toBe('cancelled');
    });

    it('fails when confirmed', () => {
      const r = makeReservation();
      r.confirmPayment('credit_card', new Date('2026-06-01T10:05:00Z'));
      expect(() => r.cancelHold(new Date())).toThrow(
        InvalidReservationTransitionException,
      );
    });
  });
});
