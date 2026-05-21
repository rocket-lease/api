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
import {
  DepositPercentageOutOfRangeException,
  EntityNotFoundException,
  RuleSetNotFoundForOwnerException,
  RuleSetPrivateCannotBeSharedException,
  RuleSetVehicleIdImmutableException,
} from '@/domain/exceptions/domain.exception';
import { ReservationRuleSet } from '@/domain/entities/reservation-rule-set.entity';
import {
  RESERVATION_RULE_SET_REPOSITORY,
  type ReservationRuleSetRepository,
} from '@/domain/repositories/reservation-rule-set.repository';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepository,
} from '@/domain/repositories/vehicle.repository';

@Injectable()
export class ReservationRuleSetService {
  constructor(
    @Inject(RESERVATION_RULE_SET_REPOSITORY)
    private readonly reservationRuleSetRepository: ReservationRuleSetRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  public async createRuleSet(ownerId: string, dto: CreateReservationRuleSetRequest) {
    const data = CreateReservationRuleSetRequestSchema.parse(dto);
    this.assertDepositPercentageValid(data.depositPercentage);

    if (data.vehicleId !== null) {
      const vehicle = await this.vehicleRepository.findById(data.vehicleId);
      if (!vehicle || !vehicle.isOwnedBy(ownerId)) {
        throw new RuleSetPrivateCannotBeSharedException();
      }
    }

    const ruleSet = new ReservationRuleSet(
      ownerId,
      data.vehicleId,
      data.name,
      data.description ?? null,
      data.cancellationPolicy,
      data.depositPercentage,
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
    if (
      dto &&
      typeof dto === 'object' &&
      'vehicleId' in (dto as Record<string, unknown>)
    ) {
      throw new RuleSetVehicleIdImmutableException();
    }
    const data = UpdateReservationRuleSetRequestSchema.parse(dto);
    if (data.depositPercentage !== undefined) {
      this.assertDepositPercentageValid(data.depositPercentage);
    }

    const existing = await this.reservationRuleSetRepository.findById(ruleSetId);
    if (!existing || existing.getRentalorId() !== ownerId) {
      throw new RuleSetNotFoundForOwnerException(ruleSetId);
    }

    existing.update({
      name: data.name,
      description: data.description,
      cancellationPolicy: data.cancellationPolicy,
      depositPercentage: data.depositPercentage,
      maxKilometrage: data.maxKilometrage,
      rentalTimeConstraints: data.rentalTimeConstraints,
    });

    const saved = await this.reservationRuleSetRepository.save(existing);
    return this.toDTO(saved);
  }

  /**
   * Lista los sets *compartidos* del rentador (vehicleId IS NULL). Los
   * privados se acceden vía `getPrivateForVehicle` y no aparecen acá
   * (US-49 AC #6).
   */
  public async listRuleSets(ownerId: string) {
    const ruleSets = await this.reservationRuleSetRepository.findByOwnerId(ownerId);
    return ruleSets.map((ruleSet) => this.toDTO(ruleSet));
  }

  public async getRuleSetById(ownerId: string, ruleSetId: string) {
    const ruleSet = await this.reservationRuleSetRepository.findById(ruleSetId);
    if (!ruleSet || ruleSet.getRentalorId() !== ownerId) {
      throw new RuleSetNotFoundForOwnerException(ruleSetId);
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

  /**
   * Obtiene el set privado asociado a un vehículo del rentador. Si el
   * vehículo no existe o pertenece a otro owner, devuelve 404 desambiguado.
   * Si el vehículo existe y es del owner pero no tiene set privado, devuelve
   * `null` (estado válido: el vehículo usa un set compartido o ninguno).
   */
  public async getPrivateForVehicle(vehicleId: string, ownerId: string) {
    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle || !vehicle.isOwnedBy(ownerId)) {
      throw new EntityNotFoundException('vehicle', vehicleId);
    }
    const ruleSet =
      await this.reservationRuleSetRepository.findPrivateByVehicleId(vehicleId);
    if (!ruleSet) return null;
    return this.toDTO(ruleSet);
  }

  public async deleteRuleSet(ownerId: string, ruleSetId: string): Promise<void> {
    const ruleSet = await this.reservationRuleSetRepository.findById(ruleSetId);
    if (!ruleSet || ruleSet.getRentalorId() !== ownerId) {
      throw new RuleSetNotFoundForOwnerException(ruleSetId);
    }
    await this.reservationRuleSetRepository.delete(ruleSetId);
  }

  private assertDepositPercentageValid(value: number | null): void {
    if (value === null) return;
    if (!Number.isInteger(value) || value < 10 || value > 50) {
      throw new DepositPercentageOutOfRangeException(value);
    }
  }

  private toDTO(ruleSet: ReservationRuleSet) {
    return ReservationRuleSetSchema.parse({
      id: ruleSet.getId(),
      rentalorId: ruleSet.getRentalorId(),
      vehicleId: ruleSet.getVehicleId(),
      name: ruleSet.getName(),
      description: ruleSet.getDescription() ?? undefined,
      cancellationPolicy: ruleSet.getCancellationPolicy(),
      depositPercentage: ruleSet.getDepositPercentage(),
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
      depositPercentage: ruleSet.getDepositPercentage(),
      maxKilometrage: ruleSet.getMaxKilometrage(),
      rentalTimeConstraints: ruleSet.getRentalTimeConstraints(),
    });
  }
}
