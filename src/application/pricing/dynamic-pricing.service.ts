import { Injectable } from '@nestjs/common';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { UtilizationFactor } from './factors/utilization.factor';
import { DemandZoneFactor } from './factors/demand-zone.factor';
import {
  DYNAMIC_PRICING_NEUTRAL,
  clampMultiplier,
} from './config/dynamic-pricing.config';

export interface DynamicPricingInput {
  vehicle: Vehicle;
  startAt: Date;
  endAt: Date;
  now?: Date;
}

/**
 * Combina los factores del motor de pricing dinámico —demanda de zona y
 * utilización del vehículo, ambas señales de demanda reales— en un único
 * multiplier final, clampeado al rango global. Si el vehículo tiene el toggle
 * apagado, devuelve `1.0` sin consultar nada.
 */
@Injectable()
export class DynamicPricingService {
  constructor(
    private readonly utilizationFactor: UtilizationFactor,
    private readonly demandZoneFactor: DemandZoneFactor,
  ) {}

  /**
   * Computa el multiplier para un vehículo. Devuelve `1.0` si el vehículo
   * tiene el pricing dinámico desactivado.
   */
  public async computeMultiplier(input: DynamicPricingInput): Promise<number> {
    if (!input.vehicle.getDynamicPricingEnabled()) {
      return DYNAMIC_PRICING_NEUTRAL;
    }
    const [utilization, demand] = await Promise.all([
      this.utilizationFactor.compute(input.vehicle),
      this.demandZoneFactor.compute(
        input.vehicle.getLatitude(),
        input.vehicle.getLongitude(),
      ),
    ]);
    return clampMultiplier(utilization * demand);
  }
}
