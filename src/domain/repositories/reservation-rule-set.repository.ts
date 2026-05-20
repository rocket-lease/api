import { ReservationRuleSet } from '@/domain/entities/reservation-rule-set.entity';

export interface ReservationRuleSetRepository {
  save(ruleSet: ReservationRuleSet): Promise<ReservationRuleSet>;
  findById(id: string): Promise<ReservationRuleSet | null>;
  findByOwnerId(ownerId: string): Promise<ReservationRuleSet[]>;
  delete(id: string): Promise<void>;
}

export const RESERVATION_RULE_SET_REPOSITORY = Symbol('ReservationRuleSetRepository');