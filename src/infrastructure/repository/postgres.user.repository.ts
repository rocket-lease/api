import { Injectable } from '@nestjs/common';
import { Prisma, User as PrismaUser } from '@prisma/client';
import { User } from '@/domain/entities/user.entity';
import {
  UserRepository,
  UserProfile,
  UpdateUserProfile,
} from '@/domain/repositories/user.repository';
import {
  InvalidEntityDataException,
  UserHasVehiclesException,
} from '@/domain/exceptions/domain.exception';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapProfile(row: PrismaUser): UserProfile {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatarUrl,
      verificationStatus:
        row.verificationStatus as UserProfile['verificationStatus'],
      level: row.level as UserProfile['level'],
      reputationScore: row.reputationScore,
      preferences: {
        transmission: (row.preferredTransmission ??
          null) as UserProfile['preferences']['transmission'],
        accessibility: row.preferredAccessibility,
        maxPriceDaily: row.preferredMaxPriceDaily,
      },
    };
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.create({
      data: {
        id: user.getId(),
        name: user.getName(),
        email: user.getEmail(),
        dni: user.getDni(),
        phone: user.getPhone(),
      },
    });
  }

  async updateBasicInfo(
    id: string,
    data: { name: string; dni: string; phone: string },
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { name: data.name, dni: data.dni, phone: data.phone },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const row: PrismaUser | null = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!row) return null;
    return new User(row.id, row.name, row.email, row.dni, row.phone);
  }

  async findById(id: string): Promise<User | null> {
    const row: PrismaUser | null = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!row) return null;
    return new User(row.id, row.name, row.email, row.dni, row.phone);
  }

  async getProfileById(id: string): Promise<UserProfile | null> {
    const row: PrismaUser | null = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!row) return null;
    return this.mapProfile(row);
  }

  async findProfilesByIds(ids: string[]): Promise<UserProfile[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.user.findMany({ where: { id: { in: ids } } });
    return rows.map((r) => this.mapProfile(r));
  }

  async updateProfile(
    id: string,
    profile: UpdateUserProfile,
  ): Promise<UserProfile> {
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        name: profile.name,
        phone: profile.phone,
        avatarUrl: profile.avatarUrl,
        preferredTransmission: profile.preferences.transmission,
        preferredAccessibility: profile.preferences.accessibility,
        preferredMaxPriceDaily: profile.preferences.maxPriceDaily,
      },
    });

    return this.mapProfile(row);
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<UserProfile> {
    const row = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl },
    });

    return this.mapProfile(row);
  }

  async deleteById(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new InvalidEntityDataException('User not found');
        }
        if (error.code === 'P2003' || error.code === 'P2014') {
          throw new UserHasVehiclesException();
        }
      }
      throw error;
    }
  }

  async markPhoneVerified(id: string, verifiedAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { phoneVerifiedAt: verifiedAt },
    });
  }

  async isPhoneVerified(id: string): Promise<boolean> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: { phoneVerifiedAt: true },
    });
    return !!row?.phoneVerifiedAt;
  }

  async clean(): Promise<void> {
    await this.prisma.user.deleteMany({});
  }
}
