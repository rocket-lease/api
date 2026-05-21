import { Injectable } from '@nestjs/common';
import { ReservationRuleSet as PrismaReservationRuleSet } from '@prisma/client';
import { ReservationRuleSet } from '@/domain/entities/reservation-rule-set.entity';
import type { ReservationRuleSetRepository } from '@/domain/repositories/reservation-rule-set.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';

type RowWithCount = PrismaReservationRuleSet & {
  _count?: { vehicles: number };
};

@Injectable()
export class PostgresReservationRuleSetRepository implements ReservationRuleSetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(ruleSet: ReservationRuleSet): Promise<ReservationRuleSet> {
    const maxKilometrage = ruleSet.getMaxKilometrage();

    const row = await this.prisma.reservationRuleSet.upsert({
      where: { id: ruleSet.getId() },
      update: {
        name: ruleSet.getName(),
        description: ruleSet.getDescription(),
        cancellationPolicy: ruleSet.getCancellationPolicy(),
        depositPercentage: ruleSet.getDepositPercentage(),
        maxKilometrageType: maxKilometrage.type,
        maxKilometrageValue:
          maxKilometrage.type === 'LIMITED'
            ? maxKilometrage.value
            : null,
        minRentalDays: ruleSet.getRentalTimeConstraints().minDays ?? null,
        maxRentalDays: ruleSet.getRentalTimeConstraints().maxDays ?? null,
      },
      create: {
        id: ruleSet.getId(),
        ownerId: ruleSet.getRentalorId(),
        vehicleId: ruleSet.getVehicleId(),
        name: ruleSet.getName(),
        description: ruleSet.getDescription(),
        cancellationPolicy: ruleSet.getCancellationPolicy(),
        depositPercentage: ruleSet.getDepositPercentage(),
        maxKilometrageType: maxKilometrage.type,
        maxKilometrageValue:
          maxKilometrage.type === 'LIMITED'
            ? maxKilometrage.value
            : null,
        minRentalDays: ruleSet.getRentalTimeConstraints().minDays ?? null,
        maxRentalDays: ruleSet.getRentalTimeConstraints().maxDays ?? null,
      },
      include: { _count: { select: { vehicles: true } } },
    });

    return this.mapToDomain(row);
  }

  async findById(id: string): Promise<ReservationRuleSet | null> {
    const row = await this.prisma.reservationRuleSet.findUnique({
      where: { id },
      include: { _count: { select: { vehicles: true } } },
    });

    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByOwnerId(ownerId: string): Promise<ReservationRuleSet[]> {
    const rows = await this.prisma.reservationRuleSet.findMany({
      where: { ownerId, vehicleId: null },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { vehicles: true } } },
    });
    return rows.map((row) => this.mapToDomain(row));
  }

  async findPrivateByVehicleId(vehicleId: string): Promise<ReservationRuleSet | null> {
    const row = await this.prisma.reservationRuleSet.findUnique({
      where: { vehicleId },
    });
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.reservationRuleSet.delete({ where: { id } });
  }

  private mapToDomain(row: RowWithCount): ReservationRuleSet {
    const maxKilometrage =
      row.maxKilometrageType === 'UNLIMITED'
        ? { type: 'UNLIMITED' as const }
        : row.maxKilometrageValue == null
          ? null
          : { type: 'LIMITED' as const, value: row.maxKilometrageValue };

    if (!maxKilometrage) {
      throw new InvalidEntityDataException('Rule set has invalid kilometraje data');
    }

    return new ReservationRuleSet(
      row.ownerId,
      row.vehicleId,
      row.name,
      row.description,
      row.cancellationPolicy,
      row.depositPercentage,
      maxKilometrage,
      {
        minDays: row.minRentalDays ?? undefined,
        maxDays: row.maxRentalDays ?? undefined,
      },
      row._count?.vehicles ?? 0,
      row.createdAt,
      row.updatedAt,
      row.id,
    );
  }
}
