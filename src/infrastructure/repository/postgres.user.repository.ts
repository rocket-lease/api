import { Injectable } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { User } from '@/domain/entities/user.entity';
import { UserRepository } from '@/domain/repositories/user.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async findByEmail(email: string): Promise<User | null> {
    const row: PrismaUser | null = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!row) return null;
    return new User(row.id, row.name, row.email, row.dni, row.phone);
  }

  async clean(): Promise<void> {
    await this.prisma.user.deleteMany({});
  }
}
