import { Inject, Injectable } from '@nestjs/common';
import type { AuthProvider } from '@/domain/providers/auth.provider';
import { AUTH_PROVIDER } from '@/domain/providers/auth.provider';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';

@Injectable()
export class VerificationService {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly authProvider: AuthProvider,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  public async resendEmailOtp(email: string): Promise<void> {
    await this.authProvider.resendSignupOtp(email);
  }

  public async verifyEmailOtp(email: string, token: string): Promise<void> {
    await this.authProvider.verifySignupOtp(email, token);
  }

  public async verifyPhoneOtp(userId: string, _token: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new InvalidEntityDataException('User not found');
    await this.userRepository.markPhoneVerified(userId, new Date());
  }

  public async getStatus(
    userId: string,
  ): Promise<{ email: boolean; phone: boolean }> {
    const [email, phone] = await Promise.all([
      this.authProvider.getEmailVerificationStatus(userId),
      this.userRepository.isPhoneVerified(userId),
    ]);
    return { email, phone };
  }
}
