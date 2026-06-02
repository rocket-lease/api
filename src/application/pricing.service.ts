import { Inject, Injectable } from '@nestjs/common';
import {
  type PricingQuoteRequest,
  PricingQuoteResponseSchema,
} from '@rocket-lease/contracts';
import { VEHICLE_REPOSITORY, type VehicleRepository } from '@/domain/repositories/vehicle.repository';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import { computePricingQuote } from './helpers/pricing';

@Injectable()
export class PricingService {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  public async quote(request: PricingQuoteRequest) {
    const vehicle = await this.vehicleRepository.findById(request.vehicleId);
    if (!vehicle) {
      throw new EntityNotFoundException('vehicle', request.vehicleId);
    }

    return PricingQuoteResponseSchema.parse(
      computePricingQuote({
        vehicleId: vehicle.getId(),
        basePriceDailyCents: vehicle.getBasePriceCents(),
        discountTiers: vehicle.getDiscountTiers(),
        startAt: new Date(request.startAt),
        endAt: new Date(request.endAt),
      }),
    );
  }
}