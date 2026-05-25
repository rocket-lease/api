import { Injectable, Inject } from '@nestjs/common';
import { BankAccount as PrismaBankAccount } from '@prisma/client';
import { BankAccount } from '@/domain/entities/bank-account.entity';
import type { BankAccountRepository } from '@/domain/repositories/bank-account.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PostgresBankAccountRepository implements BankAccountRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private mapRow(row: PrismaBankAccount): BankAccount {
    return new BankAccount(
      row.id,
      row.ownerId,
      row.provider,
      row.alias,
      row.cbu,
      row.isActive,
      row.isVerified,
      row.deletedAt,
      row.createdAt,
      row.updatedAt,
    );
  }

  async save(bankAccount: BankAccount): Promise<BankAccount> {
    const row = await this.prisma.bankAccount.upsert({
      where: { id: bankAccount.getId() },
      create: {
        id: bankAccount.getId(),
        ownerId: bankAccount.getOwnerId(),
        provider: bankAccount.getProvider(),
        alias: bankAccount.getAlias(),
        cbu: bankAccount.getCbu(),
        isActive: bankAccount.isActiveAccount(),
        isVerified: bankAccount.isVerifiedAccount(),
        deletedAt: bankAccount.getDeletedAt(),
        createdAt: bankAccount.getCreatedAt(),
        updatedAt: bankAccount.getUpdatedAt(),
      },
      update: {
        provider: bankAccount.getProvider(),
        alias: bankAccount.getAlias(),
        cbu: bankAccount.getCbu(),
        isActive: bankAccount.isActiveAccount(),
        isVerified: bankAccount.isVerifiedAccount(),
        deletedAt: bankAccount.getDeletedAt(),
        updatedAt: bankAccount.getUpdatedAt(),
      },
    });
    return this.mapRow(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.bankAccount.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async findById(id: string): Promise<BankAccount | null> {
    const row = await this.prisma.bankAccount.findUnique({ where: { id } });
    return row ? this.mapRow(row) : null;
  }

  async findByOwnerId(ownerId: string): Promise<BankAccount[]> {
    const rows = await this.prisma.bankAccount.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.mapRow(row));
  }
}