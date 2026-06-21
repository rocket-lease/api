import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { LoyaltyRepository } from '@/domain/repositories/loyalty.repository';
import { LoyaltyProfile } from '@/domain/entities/loyalty-profile.entity';
import { ExperienceTransaction } from '@/domain/entities/experience-transaction.entity';

@Injectable()
export class PrismaLoyaltyRepository extends LoyaltyRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  private reconstituteProfile(row: {
    id: string;
    conductorId: string;
    level: string;
    totalXp: number;
    pendingXp: number;
    createdAt: Date;
    updatedAt: Date;
  }): LoyaltyProfile {
    return new LoyaltyProfile({
      id: row.id,
      conductorId: row.conductorId,
      level: row.level,
      totalXp: row.totalXp,
      pendingXp: row.pendingXp,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private reconstituteTransaction(row: {
    id: string;
    profileId: string;
    amount: number;
    reservationId: string;
    reservationVehicleName: string;
    reservationVehicleId: string;
    reservationStartAt: Date;
    reservationEndAt: Date;
    status: string;
    createdAt: Date;
  }): ExperienceTransaction {
    return new ExperienceTransaction({
      id: row.id,
      profileId: row.profileId,
      amount: row.amount,
      reservationId: row.reservationId,
      reservationVehicleName: row.reservationVehicleName,
      reservationVehicleId: row.reservationVehicleId,
      reservationStartAt: row.reservationStartAt,
      reservationEndAt: row.reservationEndAt,
      status: row.status,
      createdAt: row.createdAt,
    });
  }

  async findByConductorId(conductorId: string): Promise<LoyaltyProfile | null> {
    const row = await this.prisma.loyaltyProfile.findUnique({
      where: { conductorId },
    });
    return row ? this.reconstituteProfile(row) : null;
  }

  async save(profile: LoyaltyProfile): Promise<void> {
    await this.prisma.loyaltyProfile.upsert({
      where: { id: profile.getId() },
      create: {
        id: profile.getId(),
        conductorId: profile.getConductorId(),
        level: profile.getLevel(),
        totalXp: profile.getTotalXp(),
        pendingXp: profile.getPendingXp(),
        createdAt: profile.getCreatedAt(),
        updatedAt: profile.getUpdatedAt(),
      },
      update: {
        level: profile.getLevel(),
        totalXp: profile.getTotalXp(),
        pendingXp: profile.getPendingXp(),
        updatedAt: profile.getUpdatedAt(),
      },
    });
  }

  async findTransactionsByProfileId(profileId: string): Promise<ExperienceTransaction[]> {
    const rows = await this.prisma.experienceTransaction.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.reconstituteTransaction(r));
  }

  async saveTransaction(tx: ExperienceTransaction): Promise<void> {
    await this.prisma.experienceTransaction.upsert({
      where: { id: tx.getId() },
      create: {
        id: tx.getId(),
        profileId: tx.getProfileId(),
        amount: tx.getAmount(),
        reservationId: tx.getReservationId(),
        reservationVehicleName: tx.getReservationVehicleName(),
        reservationVehicleId: tx.getReservationVehicleId(),
        reservationStartAt: tx.getReservationStartAt(),
        reservationEndAt: tx.getReservationEndAt(),
        status: tx.getStatus(),
        createdAt: tx.getCreatedAt(),
      },
      update: {
        status: tx.getStatus(),
      },
    });
  }

  async findTransactionByReservationId(
    reservationId: string,
  ): Promise<ExperienceTransaction | null> {
    const row = await this.prisma.experienceTransaction.findFirst({
      where: { reservationId },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.reconstituteTransaction(row) : null;
  }
}
