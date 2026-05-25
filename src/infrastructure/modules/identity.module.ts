import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { IdentityController } from '@/infrastructure/controllers/identity.controller';
import { IdentityService } from '@/application/identity.service';
import { IdentityVerificationJob } from '@/infrastructure/jobs/identity-verification.job';
import {
  IDENTITY_VERIFICATION_REPOSITORY,
} from '@/domain/repositories/identity-verification.repository';
import { PostgresIdentityVerificationRepository } from '@/infrastructure/repository/postgres.identity-verification.repository';
import {
  IDENTITY_VERIFICATION_PROVIDER,
} from '@/domain/providers/identity-verification.provider';
import { StubIdentityVerificationProvider } from '@/infrastructure/providers/stub.identity-verification.provider';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';

@Module({
  imports: [AuthModule],
  controllers: [IdentityController],
  providers: [
    IdentityService,
    IdentityVerificationJob,
    PrismaService,
    { provide: IDENTITY_VERIFICATION_REPOSITORY, useClass: PostgresIdentityVerificationRepository },
    { provide: IDENTITY_VERIFICATION_PROVIDER, useClass: StubIdentityVerificationProvider },
    { provide: CLOCK, useClass: SystemClock },
  ],
  exports: [IdentityService, IDENTITY_VERIFICATION_REPOSITORY, IDENTITY_VERIFICATION_PROVIDER],
})
export class IdentityModule {}