import { VerificationOtp } from '@/domain/entities/verification-otp.entity';

export interface VerificationOtpRepository {
  save(otp: VerificationOtp): Promise<VerificationOtp>;
  findActiveByUserAndChannel(
    userId: string,
    channel: 'email' | 'phone',
  ): Promise<VerificationOtp | null>;
  invalidateActiveForUserAndChannel(
    userId: string,
    channel: 'email' | 'phone',
  ): Promise<void>;
  incrementAttempts(id: string): Promise<VerificationOtp>;
  markUsed(id: string, usedAt: Date): Promise<void>;
}

export const VERIFICATION_OTP_REPOSITORY = Symbol(
  'VerificationOtpRepository',
);
