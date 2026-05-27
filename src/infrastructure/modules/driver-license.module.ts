import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { DriverLicenseController } from '@/infrastructure/controllers/driver-license.controller';
import { DriverLicenseService } from '@/application/driver-license.service';
import { DRIVER_LICENSE_VERIFICATION_REPOSITORY } from '@/domain/repositories/driver-license-verification.repository';
import { PostgresDriverLicenseVerificationRepository } from '@/infrastructure/repository/postgres.driver-license-verification.repository';
import { DRIVER_LICENSE_VERIFICATION_PROVIDER } from '@/domain/providers/driver-license-verification.provider';
import { StubDriverLicenseVerificationProvider } from '@/infrastructure/providers/stub.driver-license-verification.provider';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import { DriverLicenseVerificationJob } from '@/infrastructure/jobs/driver-license-verification.job';

@Module({
  imports: [AuthModule],
  controllers: [DriverLicenseController],
  providers: [
    DriverLicenseService,
    DriverLicenseVerificationJob,
    PrismaService,
    { provide: DRIVER_LICENSE_VERIFICATION_REPOSITORY, useClass: PostgresDriverLicenseVerificationRepository },
    { provide: DRIVER_LICENSE_VERIFICATION_PROVIDER, useClass: StubDriverLicenseVerificationProvider },
    { provide: CLOCK, useClass: SystemClock },
  ],
  exports: [DriverLicenseService, DRIVER_LICENSE_VERIFICATION_REPOSITORY, DRIVER_LICENSE_VERIFICATION_PROVIDER],
})
export class DriverLicenseModule {}