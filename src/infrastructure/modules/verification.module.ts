import { Module } from '@nestjs/common';
import { VerificationService } from '@/application/verification.service';
import { VerificationController } from '@/infrastructure/controllers/verification.controller';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
