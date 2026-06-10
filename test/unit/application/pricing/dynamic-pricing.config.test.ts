import {
  clampMultiplier,
  DYNAMIC_PRICING_MAX,
  DYNAMIC_PRICING_NEUTRAL,
} from '@/application/pricing/config/dynamic-pricing.config';

describe('clampMultiplier', () => {
  it('nunca devuelve menos que la tarifa base: el motor solo infla', () => {
    expect(clampMultiplier(0.95)).toBe(DYNAMIC_PRICING_NEUTRAL);
    expect(clampMultiplier(0.81)).toBe(DYNAMIC_PRICING_NEUTRAL);
    expect(clampMultiplier(0.7)).toBe(DYNAMIC_PRICING_NEUTRAL);
  });

  it('deja pasar los surge dentro del rango y los topea en el máximo', () => {
    expect(clampMultiplier(1.25)).toBe(1.25);
    expect(clampMultiplier(2.5)).toBe(DYNAMIC_PRICING_MAX);
  });

  it('cae a neutro ante valores no finitos', () => {
    expect(clampMultiplier(Number.NaN)).toBe(DYNAMIC_PRICING_NEUTRAL);
    expect(clampMultiplier(Number.POSITIVE_INFINITY)).toBe(
      DYNAMIC_PRICING_NEUTRAL,
    );
  });
});
