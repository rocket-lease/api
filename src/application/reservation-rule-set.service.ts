import { Inject, Injectable } from '@nestjs/common';
import {
  CreateReservationRuleSetRequest,
  CreateReservationRuleSetRequestSchema,
  CreateReservationRuleSetResponseSchema,
  ReservationRuleSetSchema,
  ReservationRuleSetPublicSchema,
  UpdateReservationRuleSetRequest,
  UpdateReservationRuleSetRequestSchema,
} from '@rocket-lease/contracts';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import { ReservationRuleSet } from '@/domain/entities/reservation-rule-set.entity';
import {
  RESERVATION_RULE_SET_REPOSITORY,
  type ReservationRuleSetRepository,
} from '@/domain/repositories/reservation-rule-set.repository';

@Injectable()
export class ReservationRuleSetService {
  constructor(
    @Inject(RESERVATION_RULE_SET_REPOSITORY)
    private readonly reservationRuleSetRepository: ReservationRuleSetRepository,
  ) {}

  public async createRuleSet(ownerId: string, dto: CreateReservationRuleSetRequest) {
    const data = CreateReservationRuleSetRequestSchema.parse(dto);
    const ruleSet = new ReservationRuleSet(
      ownerId,
      data.name,
      data.description ?? null,
      data.cancellationPolicy,
      data.deposit,
      data.maxKilometrage,
      data.rentalTimeConstraints,
      0,
    );

    const saved = await this.reservationRuleSetRepository.save(ruleSet);
    return CreateReservationRuleSetResponseSchema.parse({ id: saved.getId() });
  }

  public async updateRuleSet(
    ownerId: string,
    ruleSetId: string,
    dto: UpdateReservationRuleSetRequest,
  ) {
    const data = UpdateReservationRuleSetRequestSchema.parse(dto);
    const existing = await this.reservationRuleSetRepository.findById(ruleSetId);
    if (!existing || existing.getRentalorId() !== ownerId) {
      throw new EntityNotFoundException('reservation rule set', ruleSetId);
    }

    existing.update({
      name: data.name,
      description: data.description,
      cancellationPolicy: data.cancellationPolicy,
      deposit: data.deposit,
      maxKilometrage: data.maxKilometrage,
      rentalTimeConstraints: data.rentalTimeConstraints,
    });

    const saved = await this.reservationRuleSetRepository.save(existing);
    return this.toDTO(saved);
  }

  public async listRuleSets(ownerId: string) {
    const ruleSets = await this.reservationRuleSetRepository.findByOwnerId(ownerId);
    return ruleSets.map((ruleSet) => this.toDTO(ruleSet));
  }

  public async getRuleSetById(ownerId: string, ruleSetId: string) {
    const ruleSet = await this.reservationRuleSetRepository.findById(ruleSetId);
    if (!ruleSet || ruleSet.getRentalorId() !== ownerId) {
      throw new EntityNotFoundException('reservation rule set', ruleSetId);
    }
    return this.toDTO(ruleSet);
  }

  public async getRuleSetDetails(ruleSetId: string) {
    const ruleSet = await this.reservationRuleSetRepository.findById(ruleSetId);
    if (!ruleSet) {
      return null;
    }

    return this.toDTO(ruleSet);
  }

  /**
   * Devuelve la representación pública del set de reglas (sin campos privados).
   */
  public async getPublicRuleSet(ruleSetId: string) {
    const ruleSet = await this.reservationRuleSetRepository.findById(ruleSetId);
    if (!ruleSet) return null;
    return this.toPublicDTO(ruleSet);
  }

  public async deleteRuleSet(ownerId: string, ruleSetId: string): Promise<void> {
    const ruleSet = await this.reservationRuleSetRepository.findById(ruleSetId);
    if (!ruleSet || ruleSet.getRentalorId() !== ownerId) {
      throw new EntityNotFoundException('reservation rule set', ruleSetId);
    }
    await this.reservationRuleSetRepository.delete(ruleSetId);
  }

  private toDTO(ruleSet: ReservationRuleSet) {
    return ReservationRuleSetSchema.parse({
      id: ruleSet.getId(),
      rentalorId: ruleSet.getRentalorId(),
      name: ruleSet.getName(),
      description: ruleSet.getDescription() ?? undefined,
      cancellationPolicy: ruleSet.getCancellationPolicy(),
      deposit: ruleSet.getDeposit(),
      maxKilometrage: ruleSet.getMaxKilometrage(),
      rentalTimeConstraints: ruleSet.getRentalTimeConstraints(),
      vehicleCount: ruleSet.getVehicleCount(),
      createdAt: ruleSet.getCreatedAt().toISOString(),
      updatedAt: ruleSet.getUpdatedAt().toISOString(),
    });
  }

  private toPublicDTO(ruleSet: ReservationRuleSet) {
    return ReservationRuleSetPublicSchema.parse({
      id: ruleSet.getId(),
      rentalorId: ruleSet.getRentalorId(),
      cancellationPolicy: ruleSet.getCancellationPolicy(),
      deposit: ruleSet.getDeposit(),
      maxKilometrage: ruleSet.getMaxKilometrage(),
      rentalTimeConstraints: ruleSet.getRentalTimeConstraints(),
    });
  }
}