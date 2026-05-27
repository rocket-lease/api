import { Inject, Injectable } from '@nestjs/common';
import { Prisma, DriverLicenseVerification as PrismaDriverLicenseVerification } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { DriverLicenseVerification } from '@/domain/entities/driver-license-verification.entity';
import { type DriverLicenseVerificationRepository } from '@/domain/repositories/driver-license-verification.repository';

function mapDocuments(value: Prisma.JsonValue): any {
  return value as any;
}

@Injectable()
export class PostgresDriverLicenseVerificationRepository implements DriverLicenseVerificationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private mapRow(row: PrismaDriverLicenseVerification): DriverLicenseVerification {
    return DriverLicenseVerification.fromPersistence({
      id: row.id,
      userId: row.userId,
      status: row.status,
      providerName: row.providerName,
      providerRequestId: row.providerRequestId,
      rejectionReason: row.rejectionReason,
      submittedAt: row.submittedAt,
      reviewAfterAt: row.reviewAfterAt,
      reviewedAt: row.reviewedAt,
      verifiedAt: row.verifiedAt,
      documents: mapDocuments(row.documents),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(driverLicenseVerification: DriverLicenseVerification): Promise<DriverLicenseVerification> {
    const props = driverLicenseVerification.toPersistence();
    const row = await this.prisma.driverLicenseVerification.upsert({
      where: { userId: props.userId },
      create: {
        userId: props.userId,
        status: props.status,
        providerName: props.providerName,
        providerRequestId: props.providerRequestId,
        rejectionReason: props.rejectionReason,
        submittedAt: props.submittedAt,
        reviewAfterAt: props.reviewAfterAt,
        reviewedAt: props.reviewedAt,
        verifiedAt: props.verifiedAt,
        documents: props.documents,
      },
      update: {
        status: props.status,
        providerName: props.providerName,
        providerRequestId: props.providerRequestId,
        rejectionReason: props.rejectionReason,
        submittedAt: props.submittedAt,
        reviewAfterAt: props.reviewAfterAt,
        reviewedAt: props.reviewedAt,
        verifiedAt: props.verifiedAt,
        documents: props.documents,
      },
    });

    return this.mapRow(row);
  }

  async findByUserId(userId: string): Promise<DriverLicenseVerification | null> {
    const row = await this.prisma.driverLicenseVerification.findUnique({
      where: { userId },
    });
    return row ? this.mapRow(row) : null;
  }

  async findByUserIds(userIds: string[]): Promise<DriverLicenseVerification[]> {
    if (userIds.length === 0) return [];
    const rows = await this.prisma.driverLicenseVerification.findMany({
      where: { userId: { in: userIds } },
    });
    return rows.map((row) => this.mapRow(row));
  }

  async findByProviderRequestId(providerRequestId: string): Promise<DriverLicenseVerification | null> {
    const row = await this.prisma.driverLicenseVerification.findUnique({
      where: { providerRequestId },
    });
    return row ? this.mapRow(row) : null;
  }

  async findDueForReview(now: Date): Promise<DriverLicenseVerification[]> {
    const rows = await this.prisma.driverLicenseVerification.findMany({
      where: {
        status: 'pending',
        reviewAfterAt: { lte: now },
      },
    });
    return rows.map((row) => this.mapRow(row));
  }
}