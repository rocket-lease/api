import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { VehicleModule } from './vehicle.module';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { VehicleDocumentController } from '@/infrastructure/controllers/vehicle-document.controller';
import { VehicleDocumentService } from '@/application/vehicle-document.service';
import { VehicleDocumentVerificationJob } from '@/infrastructure/jobs/vehicle-document-verification.job';
import {
  VEHICLE_DOCUMENT_VERIFICATION_PROVIDER,
} from '@/domain/providers/vehicle-document-verification.provider';
import { StubVehicleDocumentVerificationProvider } from '@/infrastructure/providers/stub.vehicle-document-verification.provider';
import { StubNotificationProvider } from '@/infrastructure/providers/stub.notification.provider';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';

@Module({
  imports: [AuthModule, VehicleModule],
  controllers: [VehicleDocumentController],
  providers: [
    VehicleDocumentService,
    VehicleDocumentVerificationJob,
    PrismaService,
    {
      provide: VEHICLE_DOCUMENT_VERIFICATION_PROVIDER,
      useClass: StubVehicleDocumentVerificationProvider,
    },
    {
      provide: NOTIFICATION_PROVIDER,
      useClass: StubNotificationProvider,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [VehicleDocumentService],
})
export class VehicleDocumentModule {}
