import { randomUUID } from 'node:crypto';
import { ReservationRuleSet } from '@/domain/entities/reservation-rule-set.entity';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';

function makeRuleSet(
  overrides: {
    vehicleId?: string | null;
    depositPercentage?: number | null;
  } = {},
): ReservationRuleSet {
  return new ReservationRuleSet(
    randomUUID(), // rentalorId
    overrides.vehicleId ?? null,
    'Premium',
    'Set premium',
    'FLEXIBLE',
    overrides.depositPercentage === undefined ? null : overrides.depositPercentage,
    { type: 'UNLIMITED' },
    { minDays: 1 },
  );
}

describe('ReservationRuleSet entity', () => {
  describe('construction + validation', () => {
    it('creates a shared rule set (vehicleId null) with no deposit', () => {
      const rs = makeRuleSet();
      expect(rs.getVehicleId()).toBeNull();
      expect(rs.getDepositPercentage()).toBeNull();
      expect(rs.isPrivate()).toBe(false);
    });

    it('creates a private rule set with vehicleId UUID', () => {
      const vehicleId = randomUUID();
      const rs = makeRuleSet({ vehicleId });
      expect(rs.getVehicleId()).toBe(vehicleId);
      expect(rs.isPrivate()).toBe(true);
    });

    it.each([10, 20, 30, 40, 50])(
      'accepts depositPercentage = %i (in range)',
      (pct) => {
        const rs = makeRuleSet({ depositPercentage: pct });
        expect(rs.getDepositPercentage()).toBe(pct);
      },
    );

    it.each([0, 9, 51, 100, -10])(
      'rejects depositPercentage = %i (out of range)',
      (pct) => {
        expect(() => makeRuleSet({ depositPercentage: pct })).toThrow(
          InvalidEntityDataException,
        );
      },
    );

    it('rejects non-integer depositPercentage', () => {
      expect(() => makeRuleSet({ depositPercentage: 15.5 })).toThrow(
        InvalidEntityDataException,
      );
    });

    it('rejects vehicleId that is not a UUID', () => {
      expect(() => makeRuleSet({ vehicleId: 'not-a-uuid' })).toThrow(
        InvalidEntityDataException,
      );
    });
  });

  describe('update()', () => {
    it('does not expose a way to change vehicleId', () => {
      const rs = makeRuleSet({ vehicleId: randomUUID() });
      const before = rs.getVehicleId();
      rs.update({ name: 'Otro' });
      expect(rs.getVehicleId()).toBe(before);
    });

    it('updates depositPercentage when provided', () => {
      const rs = makeRuleSet();
      rs.update({ depositPercentage: 30 });
      expect(rs.getDepositPercentage()).toBe(30);
    });

    it('allows clearing the deposit by passing null', () => {
      const rs = makeRuleSet({ depositPercentage: 30 });
      rs.update({ depositPercentage: null });
      expect(rs.getDepositPercentage()).toBeNull();
    });

    it('rejects update with depositPercentage out of range', () => {
      const rs = makeRuleSet();
      expect(() => rs.update({ depositPercentage: 5 })).toThrow(
        InvalidEntityDataException,
      );
    });
  });

  describe('isPrivate()', () => {
    it('returns true when vehicleId is set', () => {
      const rs = makeRuleSet({ vehicleId: randomUUID() });
      expect(rs.isPrivate()).toBe(true);
    });

    it('returns false when vehicleId is null', () => {
      const rs = makeRuleSet();
      expect(rs.isPrivate()).toBe(false);
    });
  });
});
