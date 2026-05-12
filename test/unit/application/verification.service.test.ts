import { VerificationService } from '@/application/verification.service';
import { VerificationOtp } from '@/domain/entities/verification-otp.entity';
import {
  EntityNotFoundException,
  InvalidEntityDataException,
} from '@/domain/exceptions/domain.exception';
import { User } from '@/domain/entities/user.entity';
import { UserRepository } from '@/domain/repositories/user.repository';
import { VerificationOtpRepository } from '@/domain/repositories/verification-otp.repository';
import { EmailProvider } from '@/domain/providers/email.provider';
import { SmsProvider } from '@/domain/providers/sms.provider';
import * as bcrypt from 'bcryptjs';

function makeUser(): User {
  return new User('user-1', 'Juan', 'juan@example.com', '12345678', '1100000000');
}

describe('VerificationService', () => {
  let service: VerificationService;
  let userRepo: jest.Mocked<UserRepository>;
  let otpRepo: jest.Mocked<VerificationOtpRepository>;
  let emailProvider: jest.Mocked<EmailProvider>;
  let smsProvider: jest.Mocked<SmsProvider>;

  beforeEach(() => {
    userRepo = {
      save: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn().mockResolvedValue(makeUser()),
      markEmailVerified: jest.fn(),
      markPhoneVerified: jest.fn(),
      getVerificationStatus: jest
        .fn()
        .mockResolvedValue({ email: false, phone: false }),
    };
    otpRepo = {
      save: jest.fn().mockImplementation((otp: VerificationOtp) =>
        Promise.resolve(otp),
      ),
      findActiveByUserAndChannel: jest.fn().mockResolvedValue(null),
      invalidateActiveForUserAndChannel: jest.fn(),
      incrementAttempts: jest.fn(),
      markUsed: jest.fn(),
    };
    emailProvider = { sendOtp: jest.fn() };
    smsProvider = { sendOtp: jest.fn() };
    service = new VerificationService(
      userRepo,
      otpRepo,
      emailProvider,
      smsProvider,
    );
  });

  describe('sendOtp', () => {
    it('throws when user not found', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(service.sendOtp('missing', 'email')).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it('sends email OTP and persists hashed code', async () => {
      const res = await service.sendOtp('user-1', 'email');
      expect(emailProvider.sendOtp).toHaveBeenCalledWith(
        'juan@example.com',
        expect.stringMatching(/^\d{6}$/),
      );
      expect(otpRepo.save).toHaveBeenCalled();
      const saved = otpRepo.save.mock.calls[0][0];
      expect(saved.codeHash).not.toMatch(/^\d{6}$/);
      expect(res.sentAt).toBeDefined();
      expect(res.expiresAt).toBeDefined();
    });

    it('sends phone OTP via sms provider', async () => {
      await service.sendOtp('user-1', 'phone');
      expect(smsProvider.sendOtp).toHaveBeenCalledWith(
        '1100000000',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('invalidates previous active OTP before creating new one', async () => {
      await service.sendOtp('user-1', 'email');
      expect(
        otpRepo.invalidateActiveForUserAndChannel,
      ).toHaveBeenCalledWith('user-1', 'email');
    });

    it('rejects resend within cooldown', async () => {
      const recent = new VerificationOtp(
        'otp-1',
        'user-1',
        'email',
        'hash',
        0,
        new Date(Date.now() + 60_000),
        null,
        new Date(Date.now() - 5_000),
      );
      otpRepo.findActiveByUserAndChannel.mockResolvedValue(recent);
      await expect(service.sendOtp('user-1', 'email')).rejects.toThrow(
        InvalidEntityDataException,
      );
      expect(emailProvider.sendOtp).not.toHaveBeenCalled();
    });

    it('allows resend after cooldown', async () => {
      const old = new VerificationOtp(
        'otp-1',
        'user-1',
        'email',
        'hash',
        0,
        new Date(Date.now() + 60_000),
        null,
        new Date(Date.now() - 60_000),
      );
      otpRepo.findActiveByUserAndChannel.mockResolvedValue(old);
      await service.sendOtp('user-1', 'email');
      expect(emailProvider.sendOtp).toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    async function activeOtp(opts: Partial<VerificationOtp> = {}): Promise<VerificationOtp> {
      const hash = await bcrypt.hash('123456', 10);
      return new VerificationOtp(
        'otp-1',
        'user-1',
        opts.channel ?? 'email',
        opts.codeHash ?? hash,
        opts.attempts ?? 0,
        opts.expiresAt ?? new Date(Date.now() + 60_000),
        opts.usedAt ?? null,
        new Date(),
      );
    }

    it('returns not_found when no active OTP', async () => {
      otpRepo.findActiveByUserAndChannel.mockResolvedValue(null);
      const res = await service.verifyOtp('user-1', 'email', '123456');
      expect(res).toEqual({ verified: false, reason: 'not_found', attemptsLeft: 0 });
    });

    it('returns expired when OTP is past expiry and marks used', async () => {
      const otp = await activeOtp({ expiresAt: new Date(Date.now() - 1000) });
      otpRepo.findActiveByUserAndChannel.mockResolvedValue(otp);
      const res = await service.verifyOtp('user-1', 'email', '123456');
      expect(res).toEqual({ verified: false, reason: 'expired', attemptsLeft: 0 });
      expect(otpRepo.markUsed).toHaveBeenCalled();
    });

    it('verifies correct code and marks user email verified', async () => {
      const otp = await activeOtp();
      otpRepo.findActiveByUserAndChannel.mockResolvedValue(otp);
      const res = await service.verifyOtp('user-1', 'email', '123456');
      expect(res).toEqual({ verified: true });
      expect(userRepo.markEmailVerified).toHaveBeenCalled();
      expect(otpRepo.markUsed).toHaveBeenCalled();
    });

    it('verifies correct code and marks user phone verified', async () => {
      const otp = await activeOtp({ channel: 'phone' });
      otpRepo.findActiveByUserAndChannel.mockResolvedValue(otp);
      const res = await service.verifyOtp('user-1', 'phone', '123456');
      expect(res).toEqual({ verified: true });
      expect(userRepo.markPhoneVerified).toHaveBeenCalled();
    });

    it('returns incorrect with attemptsLeft on bad code', async () => {
      const otp = await activeOtp({ attempts: 0 });
      otpRepo.findActiveByUserAndChannel.mockResolvedValue(otp);
      otpRepo.incrementAttempts.mockResolvedValue(
        new VerificationOtp(
          otp.id,
          otp.userId,
          otp.channel,
          otp.codeHash,
          1,
          otp.expiresAt,
          null,
          otp.createdAt,
        ),
      );
      const res = await service.verifyOtp('user-1', 'email', '000000');
      expect(res).toEqual({
        verified: false,
        reason: 'incorrect',
        attemptsLeft: 2,
      });
    });

    it('returns exhausted on 3rd wrong attempt and marks used', async () => {
      const otp = await activeOtp({ attempts: 2 });
      otpRepo.findActiveByUserAndChannel.mockResolvedValue(otp);
      otpRepo.incrementAttempts.mockResolvedValue(
        new VerificationOtp(
          otp.id,
          otp.userId,
          otp.channel,
          otp.codeHash,
          3,
          otp.expiresAt,
          null,
          otp.createdAt,
        ),
      );
      const res = await service.verifyOtp('user-1', 'email', '000000');
      expect(res).toEqual({ verified: false, reason: 'exhausted', attemptsLeft: 0 });
      expect(otpRepo.markUsed).toHaveBeenCalled();
      expect(userRepo.markEmailVerified).not.toHaveBeenCalled();
    });
  });

  describe('sendOtpsAfterRegister', () => {
    it('sends both email and phone OTPs', async () => {
      await service.sendOtpsAfterRegister('user-1');
      expect(emailProvider.sendOtp).toHaveBeenCalled();
      expect(smsProvider.sendOtp).toHaveBeenCalled();
    });

    it('does not throw when one channel fails', async () => {
      emailProvider.sendOtp.mockRejectedValue(new Error('SMTP down'));
      await expect(
        service.sendOtpsAfterRegister('user-1'),
      ).resolves.toBeUndefined();
      expect(smsProvider.sendOtp).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('returns user verification status', async () => {
      userRepo.getVerificationStatus.mockResolvedValue({
        email: true,
        phone: false,
      });
      const res = await service.getStatus('user-1');
      expect(res).toEqual({ email: true, phone: false });
    });
  });
});
