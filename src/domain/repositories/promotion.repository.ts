import { Promotion } from "../entities/promotion/promotion.entity";

export interface PromotionDuration {
  days: number;
  valueInCents: number;
}

export interface PromotionRepository {
  save(promotion: Promotion): Promise<Promotion>;
  findByVehicleId(vehicleId: string): Promise<Promotion | null>;
  findAllActive(): Promise<Promotion[]>;
  delete(vehicleId: string): Promise<void>;
  findAllDurations(): Promise<PromotionDuration[]>;
}

export const PROMOTION_REPOSITORY = Symbol('PromotionRepository');
