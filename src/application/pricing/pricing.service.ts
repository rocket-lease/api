import { Inject, Injectable } from '@nestjs/common';
import {
  type PricingQuoteRequest,
  type PricingQuote,
  PricingQuoteResponseSchema,
} from '@rocket-lease/contracts';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepository,
} from '@/domain/repositories/vehicle.repository';
import {
  PRICE_QUOTE_REPOSITORY,
  type PriceQuoteRepository,
} from '@/domain/repositories/price-quote.repository';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { PriceQuote as PriceQuoteEntity } from '@/domain/entities/price-quote.entity';
import { DynamicPricingService } from './dynamic-pricing.service';
import {
  computePricingTotal,
  selectAppliedDiscountTier,
} from '@/application/helpers/pricing';
import { PRICE_QUOTE_TTL_MS } from './config/dynamic-pricing.config';
import { latLonToH3 } from '@/application/helpers/h3';
import { LoyaltyService } from '@/application/loyalty.service';

export interface InternalQuoteResult {
  quote: PriceQuoteEntity;
  response: PricingQuote;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Service principal de pricing. Cotiza precios para un vehículo y persiste
 * un PriceQuote con TTL corto cuyo token el cliente puede reusar al crear
 * la reserva para garantizar que paga el precio que vio.
 */
@Injectable()
export class PricingService {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(PRICE_QUOTE_REPOSITORY)
    private readonly priceQuoteRepository: PriceQuoteRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
    @Inject(DynamicPricingService)
    private readonly dynamicPricingService: DynamicPricingService,
    @Inject(LoyaltyService)
    private readonly loyaltyService: LoyaltyService,
  ) {}

  /**
   * Cotiza un alquiler aplicando pricing dinámico (si el vehículo lo tiene
   * activo) y descuento por duración. Persiste un PriceQuote y devuelve el
   * payload con `quoteToken` y `expiresAt`. Si se provee `conductorId`, el
   * quote queda asociado a ese conductor y no puede ser reusado por otro.
   */
  public async quote(
    request: PricingQuoteRequest,
    conductorId: string | null = null,
  ): Promise<PricingQuote> {
    const vehicle = await this.vehicleRepository.findById(request.vehicleId);
    if (!vehicle) {
      throw new EntityNotFoundException('vehicle', request.vehicleId);
    }
    const startAt = new Date(request.startAt);
    const endAt = new Date(request.endAt);
    const result = await this.quoteForVehicle({
      vehicle,
      startAt,
      endAt,
      withHomeDelivery: request.withHomeDelivery ?? false,
      withHomeReturn: request.withHomeReturn ?? false,
      conductorId,
    });
    return result.response;
  }

  /**
   * Cotiza para un vehículo ya cargado en memoria. Esta variante la usa el
   * flujo de creación / extensión de reservas para evitar buscar el vehículo
   * dos veces.
   */
  public async quoteForVehicle(input: {
    vehicle: Vehicle;
    startAt: Date;
    endAt: Date;
    withHomeDelivery: boolean;
    withHomeReturn: boolean;
    conductorId: string | null;
  }): Promise<InternalQuoteResult> {
    const { vehicle, startAt, endAt, withHomeDelivery, withHomeReturn, conductorId } = input;
    const now = this.clock.now();
    const multiplier = await this.dynamicPricingService.computeMultiplier({
      vehicle,
      startAt,
      endAt,
      now,
    });
    const durationDays = computeDurationDays(startAt, endAt);
    const discountTiers = vehicle.getDiscountTiers();
    const appliedTier = selectAppliedDiscountTier(durationDays, discountTiers);
    const discountPercentage = appliedTier?.discountPercentage ?? 0;
    const levelDiscountPercentage = conductorId
      ? await this.loyaltyService.getDiscountPercentage(conductorId)
      : 0;
    const deliveryFeeCents =
      (withHomeDelivery ? vehicle.getHomeDeliveryFeeCents() ?? 0 : 0) +
      (withHomeReturn ? vehicle.getHomeReturnFeeCents() ?? 0 : 0);
    const totals = computePricingTotal({
      basePriceDailyCents: vehicle.getBasePriceCents(),
      startAt,
      endAt,
      multiplier,
      discountPercentage,
      levelDiscountPercentage,
      deliveryFeeCents,
    });
    const h3Cell =
      latLonToH3(vehicle.getLatitude(), vehicle.getLongitude()) ?? 'unknown';
    const expiresAt = new Date(now.getTime() + PRICE_QUOTE_TTL_MS);

    const quote = new PriceQuoteEntity({
      vehicleId: vehicle.getId(),
      conductorId: input.conductorId,
      startAt,
      endAt,
      basePriceCents: vehicle.getBasePriceCents(),
      multiplier,
      discountPercentage,
      deliveryFeeCents,
      totalCents: totals.totalCents,
      currency: 'ARS',
      h3Cell,
      createdAt: now,
      expiresAt,
      levelDiscountPercentage: levelDiscountPercentage > 0 ? levelDiscountPercentage : undefined,
    });
    const saved = await this.priceQuoteRepository.save(quote);

    const response = PricingQuoteResponseSchema.parse({
      vehicleId: vehicle.getId(),
      currency: 'ARS',
      basePriceCents: vehicle.getBasePriceCents(),
      durationDays: totals.durationDays,
      subtotalCents: totals.subtotalCents,
      appliedDiscountTier: appliedTier,
      appliedDiscountPercentage: discountPercentage,
      discountCents: totals.discountCents,
      totalCents: totals.totalCents,
      multiplier,
      deliveryFeeCents,
      quoteToken: saved.getId(),
      expiresAt: expiresAt.toISOString(),
      levelDiscountPercentage: levelDiscountPercentage > 0 ? levelDiscountPercentage : undefined,
    });

    return { quote: saved, response };
  }
}

function computeDurationDays(startAt: Date, endAt: Date): number {
  const ms = endAt.getTime() - startAt.getTime();
  return Math.max(1, Math.ceil(ms / DAY_MS));
}
