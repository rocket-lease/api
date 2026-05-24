import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreatePaymentMethodData,
  UpdatePaymentMethodData,
  PaymentMethodRepository,
} from '@/domain/repositories/payment-method.repository';
import { SavedPaymentMethod, SavedPaymentMethodSchema } from '@rocket-lease/contracts';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaPaymentMethodRepository implements PaymentMethodRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToDomain(record: any): SavedPaymentMethod {
    return SavedPaymentMethodSchema.parse({
      id: record.id,
      type: record.type,
      details: record.details,
      createdAt: record.createdAt.toISOString(),
      isDefault: record.isDefault,
    });
  }

  public async create(data: CreatePaymentMethodData): Promise<SavedPaymentMethod> {
    const record = await this.prisma.userPaymentMethod.create({
      data: {
        userId: data.userId,
        type: data.type as any,
        details: data.details as Prisma.JsonObject,
        isDefault: data.isDefault ?? false,
      },
    });
    return this.mapToDomain(record);
  }

  public async findById(id: string): Promise<SavedPaymentMethod | null> {
    const record = await this.prisma.userPaymentMethod.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  public async findByUserId(userId: string): Promise<SavedPaymentMethod[]> {
    const records = await this.prisma.userPaymentMethod.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.mapToDomain(r));
  }

  public async update(id: string, data: UpdatePaymentMethodData): Promise<SavedPaymentMethod> {
    const record = await this.prisma.userPaymentMethod.update({
      where: { id },
      data: {
        ...(data.details !== undefined && { details: data.details as Prisma.JsonObject }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });
    return this.mapToDomain(record);
  }

  public async delete(id: string): Promise<void> {
    await this.prisma.userPaymentMethod.delete({
      where: { id },
    });
  }
}
