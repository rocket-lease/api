import { Injectable } from '@nestjs/common';
import { ReservationRuleSet } from '@/domain/entities/reservation-rule-set.entity';
import type { ReservationRuleSetRepository } from '@/domain/repositories/reservation-rule-set.repository';

/**
 * Implementación in-memory del repositorio de sets de reglas. Se usa en
 * tests unitarios para aislar el flujo del service sin depender de Postgres.
 * No se registra en ningún módulo de producción.
 */
@Injectable()
export class InMemoryReservationRuleSetRepository
  implements ReservationRuleSetRepository
{
  private readonly store = new Map<string, ReservationRuleSet>();

  async save(ruleSet: ReservationRuleSet): Promise<ReservationRuleSet> {
    this.store.set(ruleSet.getId(), ruleSet);
    return ruleSet;
  }

  async findById(id: string): Promise<ReservationRuleSet | null> {
    return this.store.get(id) ?? null;
  }

  async findByOwnerId(ownerId: string): Promise<ReservationRuleSet[]> {
    return Array.from(this.store.values()).filter(
      (rs) => rs.getRentalorId() === ownerId && !rs.isPrivate(),
    );
  }

  async findPrivateByVehicleId(
    vehicleId: string,
  ): Promise<ReservationRuleSet | null> {
    return (
      Array.from(this.store.values()).find(
        (rs) => rs.getVehicleId() === vehicleId,
      ) ?? null
    );
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
