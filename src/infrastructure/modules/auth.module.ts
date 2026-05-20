import { Module } from '@nestjs/common';
import { AuthService } from '@/application/auth.service';
import { AuthController } from '@/infrastructure/controllers/auth.controller';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PostgresUserRepository } from '@/infrastructure/repository/postgres.user.repository';
import { PostgresReservationRepository } from '@/infrastructure/repository/postgres.reservation.repository';
import { SupabaseAuthProvider } from '@/infrastructure/providers/supabase.auth.provider';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { AUTH_PROVIDER } from '@/domain/providers/auth.provider';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    { provide: USER_REPOSITORY, useClass: PostgresUserRepository },
    { provide: AUTH_PROVIDER, useClass: SupabaseAuthProvider },
    {
      provide: RESERVATION_REPOSITORY,
      useClass: PostgresReservationRepository,
    },
  ],
  exports: [AuthService, PrismaService, USER_REPOSITORY, AUTH_PROVIDER],
})
export class AuthModule {}
