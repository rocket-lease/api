import { Inject, Injectable } from '@nestjs/common';
import {
  Prisma,
  IdentityVerification as PrismaIdentityVerification,
  IdentityVerificationStatus,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { IdentityVerification } from '@/domain/entities/identity-verification.entity';
import {
  type IdentityVerificationRepository,
} from '@/domain/repositories/identity-verification.repository';

function mapDocuments(value: Prisma.JsonValue): any {
  return value as any;
}

@Injectable()
export class PostgresIdentityVerificationRepository implements IdentityVerificationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private mapRow(row: PrismaIdentityVerification): IdentityVerification {
    return IdentityVerification.fromPersistence({
      id: row.id,
      userId: row.userId,
      status: row.status as any,
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

  async save(identityVerification: IdentityVerification): Promise<IdentityVerification> {
    const props = identityVerification.toPersistence();
    const row = await this.prisma.identityVerification.upsert({
      where: { userId: props.userId },
      create: {
        userId: props.userId,
        status: props.status as IdentityVerificationStatus,
        providerName: props.providerName,
        providerRequestId: props.providerRequestId,
        rejectionReason: props.rejectionReason,
        submittedAt: props.submittedAt,
        reviewAfterAt: props.reviewAfterAt,
        reviewedAt: props.reviewedAt,
        verifiedAt: props.verifiedAt,
        documents: props.documents as Prisma.InputJsonValue,
      },
      update: {
        status: props.status as IdentityVerificationStatus,
        providerName: props.providerName,
        providerRequestId: props.providerRequestId,
        rejectionReason: props.rejectionReason,
        submittedAt: props.submittedAt,
        reviewAfterAt: props.reviewAfterAt,
        reviewedAt: props.reviewedAt,
        verifiedAt: props.verifiedAt,
        documents: props.documents as Prisma.InputJsonValue,
      },
    });

    return this.mapRow(row);
  }

  async findByUserId(userId: string): Promise<IdentityVerification | null> {
    const row = await this.prisma.identityVerification.findUnique({
      where: { userId },
    });
    return row ? this.mapRow(row) : null;
  }

  async findByUserIds(userIds: string[]): Promise<IdentityVerification[]> {
    if (userIds.length === 0) return [];
    const rows = await this.prisma.identityVerification.findMany({
      where: { userId: { in: userIds } },
    });
    return rows.map((row) => this.mapRow(row));
  }

  async findByProviderRequestId(providerRequestId: string): Promise<IdentityVerification | null> {
    const row = await this.prisma.identityVerification.findUnique({
      where: { providerRequestId },
    });
    return row ? this.mapRow(row) : null;
  }

  async findDueForReview(now: Date): Promise<IdentityVerification[]> {
    const rows = await this.prisma.identityVerification.findMany({
      where: {
        status: 'pending',
        reviewAfterAt: { lte: now },
      },
    });
    return rows.map((row) => this.mapRow(row));
  }
}