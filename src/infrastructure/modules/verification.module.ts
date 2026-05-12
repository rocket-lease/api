import { forwardRef, Module } from '@nestjs/common';
import { VerificationService } from '@/application/verification.service';
import { VerificationController } from '@/infrastructure/controllers/verification.controller';
import { PostgresVerificationOtpRepository } from '@/infrastructure/repository/postgres.verification-otp.repository';
import { GmailEmailProvider } from '@/infrastructure/providers/gmail.email.provider';
import { StubSmsProvider } from '@/infrastructure/providers/stub.sms.provider';
import { VERIFICATION_OTP_REPOSITORY } from '@/domain/repositories/verification-otp.repository';
import { EMAIL_PROVIDER } from '@/domain/providers/email.provider';
import { SMS_PROVIDER } from '@/domain/providers/sms.provider';
import { AuthModule } from './auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    {
      provide: VERIFICATION_OTP_REPOSITORY,
      useClass: PostgresVerificationOtpRepository,
    },
    { provide: EMAIL_PROVIDER, useClass: GmailEmailProvider },
    { provide: SMS_PROVIDER, useClass: StubSmsProvider },
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
