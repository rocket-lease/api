import { Injectable } from '@nestjs/common';
import { VerificationOtp as PrismaOtp } from '@prisma/client';
import { VerificationOtp } from '@/domain/entities/verification-otp.entity';
import { VerificationOtpRepository } from '@/domain/repositories/verification-otp.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PostgresVerificationOtpRepository
  implements VerificationOtpRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async save(otp: VerificationOtp): Promise<VerificationOtp> {
    const row = await this.prisma.verificationOtp.create({
      data: {
        id: otp.id,
        userId: otp.userId,
        channel: otp.channel,
        codeHash: otp.codeHash,
        attempts: otp.attempts,
        expiresAt: otp.expiresAt,
        usedAt: otp.usedAt,
        createdAt: otp.createdAt,
      },
    });
    return this.toDomain(row);
  }

  async findActiveByUserAndChannel(
    userId: string,
    channel: 'email' | 'phone',
  ): Promise<VerificationOtp | null> {
    const row = await this.prisma.verificationOtp.findFirst({
      where: { userId, channel, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async invalidateActiveForUserAndChannel(
    userId: string,
    channel: 'email' | 'phone',
  ): Promise<void> {
    await this.prisma.verificationOtp.updateMany({
      where: { userId, channel, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async incrementAttempts(id: string): Promise<VerificationOtp> {
    const row = await this.prisma.verificationOtp.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
    return this.toDomain(row);
  }

  async markUsed(id: string, usedAt: Date): Promise<void> {
    await this.prisma.verificationOtp.update({
      where: { id },
      data: { usedAt },
    });
  }

  async clean(): Promise<void> {
    await this.prisma.verificationOtp.deleteMany({});
  }

  private toDomain(row: PrismaOtp): VerificationOtp {
    return new VerificationOtp(
      row.id,
      row.userId,
      row.channel as 'email' | 'phone',
      row.codeHash,
      row.attempts,
      row.expiresAt,
      row.usedAt,
      row.createdAt,
    );
  }
}
