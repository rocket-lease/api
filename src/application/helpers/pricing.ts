import type {
  PricingDiscountTier,
  PricingDiscountTiers,
  PricingQuote,
} from '@rocket-lease/contracts';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * @deprecated Usar `PricingService.quote()` o `computePricingTotal()` con
 *   multiplier=1 y discountPercentage=0 para nuevo código. Mantener este
 *   export por compatibilidad con callers legacy hasta migrarlos.
 */
export function computeReservationTotalCents(
  basePriceDailyCents: number,
  startAt: Date,
  endAt: Date,
  homeDeliveryFeeCents: number | null = null,
  homeReturnFeeCents: number | null = null,
): number {
  const base = computeBaseRentalCents(basePriceDailyCents, startAt, endAt);
  return base + (homeDeliveryFeeCents ?? 0) + (homeReturnFeeCents ?? 0);
}

/**
 * Subtotal sin multiplier ni descuentos: cobra por día (redondeando partial
 * days hacia arriba) o por hora cuando la ventana es menor a 24h.
 */
export function computeBaseRentalCents(
  basePriceDailyCents: number,
  startAt: Date,
  endAt: Date,
): number {
  const ms = endAt.getTime() - startAt.getTime();
  if (ms <= 0) return 0;
  if (ms >= DAY_MS) {
    const days = Math.ceil(ms / DAY_MS);
    return Math.round(days * basePriceDailyCents);
  }
  const hours = Math.ceil(ms / HOUR_MS);
  const hourlyRate = Math.round(basePriceDailyCents / 24);
  return hours * hourlyRate;
}

/**
 * Compone el total cobrable aplicando la fórmula:
 *   (base × multiplier) × (1 - descuento%) + deliveryFee
 *
 * El multiplier se aplica antes que el descuento para que el conductor vea
 * el descuento aplicado sobre el precio dinámico (no aparece un cargo
 * misterioso). El cargo de entrega a domicilio NO se multiplica.
 */
export function computePricingTotal(input: {
  basePriceDailyCents: number;
  startAt: Date;
  endAt: Date;
  multiplier: number;
  discountPercentage: number;
  levelDiscountPercentage?: number;
  deliveryFeeCents: number;
}): { subtotalCents: number; discountCents: number; totalCents: number; durationDays: number } {
  const base = computeBaseRentalCents(
    input.basePriceDailyCents,
    input.startAt,
    input.endAt,
  );
  const withMultiplier = Math.round(base * input.multiplier);
  const discountCents = Math.floor(
    (withMultiplier * input.discountPercentage) / 100,
  );
  const afterDiscount = withMultiplier - discountCents;
  const levelDiscount = (input.levelDiscountPercentage ?? 0);
  const levelDiscountCents = levelDiscount > 0
    ? Math.floor((afterDiscount * levelDiscount) / 100)
    : 0;
  const withLevelDiscount = afterDiscount - levelDiscountCents;
  const totalCents = withLevelDiscount + input.deliveryFeeCents;
  const ms = input.endAt.getTime() - input.startAt.getTime();
  const durationDays = Math.max(1, Math.ceil(ms / DAY_MS));
  return {
    subtotalCents: withMultiplier,
    discountCents,
    totalCents,
    durationDays,
  };
}

export function selectAppliedDiscountTier(
  durationDays: number,
  discountTiers: PricingDiscountTiers,
): PricingDiscountTier | null {
  const sorted = [...discountTiers].sort(
    (left, right) => left.minimumDays - right.minimumDays,
  );

  let applied: PricingDiscountTier | null = null;
  for (const tier of sorted) {
    if (durationDays >= tier.minimumDays) {
      applied = tier;
      continue;
    }
    break;
  }

  return applied;
}

export function computePricingQuote(params: {
  vehicleId: string;
  basePriceDailyCents: number;
  discountTiers: PricingDiscountTiers;
  startAt: Date;
  endAt: Date;
}): PricingQuote {
  const ms = params.endAt.getTime() - params.startAt.getTime();
  if (ms <= 0) {
    throw new Error('endAt must be after startAt');
  }

  const subtotalCents = computeReservationTotalCents(
    params.basePriceDailyCents,
    params.startAt,
    params.endAt,
  );
  const durationDays = Math.max(1, Math.ceil(ms / DAY_MS));
  const appliedDiscountTier = selectAppliedDiscountTier(
    durationDays,
    params.discountTiers,
  );
  const appliedDiscountPercentage = appliedDiscountTier?.discountPercentage ?? 0;
  const discountCents = Math.floor(
    (subtotalCents * appliedDiscountPercentage) / 100,
  );

  return {
    vehicleId: params.vehicleId,
    currency: 'ARS',
    basePriceCents: params.basePriceDailyCents,
    durationDays,
    subtotalCents,
    appliedDiscountTier,
    appliedDiscountPercentage,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}

/**
 * Calcula el monto de la seña a cobrar al confirmar la reserva, en cents.
 *
 * - Si `depositPercentage` es `null` (vehículo/set sin seña), devuelve `0`.
 * - Si tiene valor, devuelve `floor(total * pct / 100)`. Se usa `floor` (no
 *   `round`) para garantizar que la seña nunca exceda el total —el conductor
 *   paga *como mucho* el porcentaje pactado—.
 *
 * El resto a cobrar al retiro se calcula como `total - deposit`, no se
 * materializa acá.
 */
export function computeDepositCents(
  totalCents: number,
  depositPercentage: number | null,
): number {
  if (depositPercentage === null) return 0;
  if (totalCents <= 0) return 0;
  return Math.floor((totalCents * depositPercentage) / 100);
}
