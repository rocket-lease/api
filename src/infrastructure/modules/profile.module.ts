import { Module } from '@nestjs/common';
import { ProfileService } from '@/application/profile.service';
import { ProfileController } from '@/infrastructure/controllers/profile.controller';
import { AuthModule } from './auth.module';
import { IdentityModule } from './identity.module';
import { DriverLicenseModule } from './driver-license.module';
import { ReputationModule } from './reputation.module';
import { MEDIA_PROVIDER } from '@/domain/providers/media.provider';
import { CloudinaryMediaProvider } from '@/infrastructure/providers/cloudinary.media.provider';
import { PaymentMethodController } from '@/infrastructure/controllers/payment-method.controller';
import { PaymentMethodService } from '@/application/payment-method.service';
import { PrismaPaymentMethodRepository } from '@/infrastructure/database/repositories/prisma-payment-method.repository';
import { PAYMENT_METHOD_REPOSITORY } from '@/domain/repositories/payment-method.repository';

@Module({

  imports: [AuthModule, IdentityModule, DriverLicenseModule, ReputationModule],
  controllers: [PaymentMethodController,ProfileController],
  providers: [
    ProfileService,
    PaymentMethodService,
    { provide: MEDIA_PROVIDER, useClass: CloudinaryMediaProvider },
    { provide: PAYMENT_METHOD_REPOSITORY, useClass: PrismaPaymentMethodRepository },
  ],
})
export class ProfileModule {}
