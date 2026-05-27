import { ReservationRuleSet } from '@/domain/entities/reservation-rule-set.entity';

export interface ReservationRuleSetRepository {
  save(ruleSet: ReservationRuleSet): Promise<ReservationRuleSet>;
  findById(id: string): Promise<ReservationRuleSet | null>;
  /**
   * Lista los sets *compartidos* del rentador (vehicleId IS NULL).
   * Los privados se acceden vía `findPrivateByVehicleId` y nunca aparecen
   * en el listado del perfil del rentador.
   */
  findByOwnerId(ownerId: string): Promise<ReservationRuleSet[]>;
  /**
   * Devuelve el set privado asociado a un vehículo, si existe. Único por
   * `vehicleId` (constraint UNIQUE en DB).
   */
  findPrivateByVehicleId(vehicleId: string): Promise<ReservationRuleSet | null>;
  delete(id: string): Promise<void>;
}

export const RESERVATION_RULE_SET_REPOSITORY = Symbol('ReservationRuleSetRepository');
