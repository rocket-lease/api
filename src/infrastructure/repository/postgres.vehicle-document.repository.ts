import { Inject, Injectable } from '@nestjs/common';
import {
  Prisma,
  VehicleDocumentVerification as PrismaVehicleDocumentVerification,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { VehicleDocumentVerification } from '@/domain/entities/vehicle-document-verification.entity';
import {
  type VehicleDocumentRepository,
} from '@/domain/repositories/vehicle-document.repository';

function mapDocuments(value: Prisma.JsonValue): any {
  return value as any;
}

@Injectable()
export class PostgresVehicleDocumentRepository implements VehicleDocumentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private mapRow(row: PrismaVehicleDocumentVerification): VehicleDocumentVerification {
    return VehicleDocumentVerification.fromPersistence({
      id: row.id,
      vehicleId: row.vehicleId,
      rentadorId: row.rentadorId,
      status: row.status,
      documents: mapDocuments(row.documents),
      rejectionReason: row.rejectionReason,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      verifiedAt: row.verifiedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(
    verification: VehicleDocumentVerification,
  ): Promise<VehicleDocumentVerification> {
    const props = verification.toPersistence();
    const row = await this.prisma.vehicleDocumentVerification.upsert({
      where: { vehicleId: props.vehicleId },
      create: {
        vehicleId: props.vehicleId,
        rentadorId: props.rentadorId,
        status: props.status,
        documents: props.documents,
        rejectionReason: props.rejectionReason,
        submittedAt: props.submittedAt,
        reviewedAt: props.reviewedAt,
        verifiedAt: props.verifiedAt,
      },
      update: {
        status: props.status,
        documents: props.documents,
        rejectionReason: props.rejectionReason,
        submittedAt: props.submittedAt,
        reviewedAt: props.reviewedAt,
        verifiedAt: props.verifiedAt,
      },
    });

    return this.mapRow(row);
  }

  async findByVehicleId(vehicleId: string): Promise<VehicleDocumentVerification | null> {
    const row = await this.prisma.vehicleDocumentVerification.findUnique({
      where: { vehicleId },
    });
    return row ? this.mapRow(row) : null;
  }

  async findPending(): Promise<VehicleDocumentVerification[]> {
    const rows = await this.prisma.vehicleDocumentVerification.findMany({
      where: { status: 'pending' },
    });
    return rows.map((row) => this.mapRow(row));
  }
}
