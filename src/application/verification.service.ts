import { Inject, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  type VerificationChannel,
  type SendOtpResponse,
  type VerifyOtpResponse,
  type VerificationStatusResponse,
} from '@rocket-lease/contracts';
import { VerificationOtp } from '@/domain/entities/verification-otp.entity';
import {
  EntityNotFoundException,
  InvalidEntityDataException,
} from '@/domain/exceptions/domain.exception';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import type { VerificationOtpRepository } from '@/domain/repositories/verification-otp.repository';
import { VERIFICATION_OTP_REPOSITORY } from '@/domain/repositories/verification-otp.repository';
import type { EmailProvider } from '@/domain/providers/email.provider';
import { EMAIL_PROVIDER } from '@/domain/providers/email.provider';
import type { SmsProvider } from '@/domain/providers/sms.provider';
import { SMS_PROVIDER } from '@/domain/providers/sms.provider';
import { randomInt, randomUUID } from 'node:crypto';

@Injectable()
export class VerificationService {
  static readonly RESEND_COOLDOWN_SECONDS = 30;

  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(VERIFICATION_OTP_REPOSITORY)
    private readonly otpRepository: VerificationOtpRepository,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  public async sendOtp(
    userId: string,
    channel: VerificationChannel,
  ): Promise<SendOtpResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new EntityNotFoundException('user', userId);

    const existing = await this.otpRepository.findActiveByUserAndChannel(
      userId,
      channel,
    );
    if (existing) {
      const secondsSinceCreated =
        (Date.now() - existing.createdAt.getTime()) / 1000;
      if (secondsSinceCreated < VerificationService.RESEND_COOLDOWN_SECONDS) {
        throw new InvalidEntityDataException(
          `Resend cooldown active, retry in ${Math.ceil(
            VerificationService.RESEND_COOLDOWN_SECONDS - secondsSinceCreated,
          )}s`,
        );
      }
    }

    await this.otpRepository.invalidateActiveForUserAndChannel(userId, channel);

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + VerificationOtp.TTL_MINUTES * 60 * 1000,
    );

    const otp = new VerificationOtp(
      randomUUID(),
      userId,
      channel,
      codeHash,
      0,
      expiresAt,
      null,
      now,
    );
    await this.otpRepository.save(otp);

    if (channel === 'email') {
      await this.emailProvider.sendOtp(user.getEmail(), code);
    } else {
      await this.smsProvider.sendOtp(user.getPhone(), code);
    }

    return {
      sentAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  public async sendOtpsAfterRegister(userId: string): Promise<void> {
    try {
      await this.sendOtp(userId, 'email');
    } catch (err) {
      this.logger.warn(
        `Email OTP send failed for ${userId}: ${err instanceof Error ? err.message : err}`,
      );
    }
    try {
      await this.sendOtp(userId, 'phone');
    } catch (err) {
      this.logger.warn(
        `Phone OTP send failed for ${userId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  public async verifyOtp(
    userId: string,
    channel: VerificationChannel,
    code: string,
  ): Promise<VerifyOtpResponse> {
    const otp = await this.otpRepository.findActiveByUserAndChannel(
      userId,
      channel,
    );
    if (!otp) {
      return { verified: false, reason: 'not_found', attemptsLeft: 0 };
    }

    if (otp.isExpired()) {
      await this.otpRepository.markUsed(otp.id, new Date());
      return { verified: false, reason: 'expired', attemptsLeft: 0 };
    }

    if (otp.isExhausted()) {
      await this.otpRepository.markUsed(otp.id, new Date());
      return { verified: false, reason: 'exhausted', attemptsLeft: 0 };
    }

    const match = await bcrypt.compare(code, otp.codeHash);
    if (!match) {
      const updated = await this.otpRepository.incrementAttempts(otp.id);
      const exhausted = updated.isExhausted();
      if (exhausted) {
        await this.otpRepository.markUsed(otp.id, new Date());
        return { verified: false, reason: 'exhausted', attemptsLeft: 0 };
      }
      return {
        verified: false,
        reason: 'incorrect',
        attemptsLeft: updated.attemptsLeft(),
      };
    }

    const now = new Date();
    await this.otpRepository.markUsed(otp.id, now);
    if (channel === 'email') {
      await this.userRepository.markEmailVerified(userId, now);
    } else {
      await this.userRepository.markPhoneVerified(userId, now);
    }

    return { verified: true };
  }

  public async getStatus(
    userId: string,
  ): Promise<VerificationStatusResponse> {
    return this.userRepository.getVerificationStatus(userId);
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }
}
