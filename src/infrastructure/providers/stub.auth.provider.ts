import { Injectable } from '@nestjs/common';
import { AuthProvider } from '@/domain/providers/auth.provider';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';
import { randomUUID } from 'node:crypto';

@Injectable()
export class StubAuthProvider implements AuthProvider {
  static readonly STUB_TOKEN = randomUUID();
  static readonly STUB_USER_ID = '00000000-0000-0000-0000-000000000001';

  static readonly STUB_OTP = '123456';

  private readonly registeredEmails = new Set<string>();
  private readonly userIdByEmail = new Map<string, string>();
  private readonly userIdByToken = new Map<string, string>();
  private readonly emailConfirmedUserIds = new Set<string>();
  public readonly resetEmailsSent: string[] = [];
  public readonly signupOtpsSent: string[] = [];
  public readonly passwordUpdates: Array<{
    userId: string;
    newPassword: string;
  }> = [];

  public async signUp(
    email: string,
    _password: string,
  ): Promise<{ userId: string }> {
    if (this.registeredEmails.has(email) || this.userIdByEmail.has(email)) {
      throw new Error('Email already registered in auth provider');
    }
    this.registeredEmails.add(email);
    this.userIdByEmail.set(email, StubAuthProvider.STUB_USER_ID);
    this.signupOtpsSent.push(email);
    return { userId: StubAuthProvider.STUB_USER_ID };
  }

  public async signIn(
    email: string,
    _password: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const userId = this.userIdByEmail.get(email);
    if (!userId) {
      throw new Error('User is not registered in auth provider');
    }

    const accessToken = `${StubAuthProvider.STUB_TOKEN}:${userId}`;
    this.userIdByToken.set(accessToken, userId);

    return {
      access_token: accessToken,
      refresh_token: 'stub-refresh-token',
      expires_in: 3600,
    };
  }

  public async verifyToken(token: string): Promise<{ userId: string }> {
    if (token === StubAuthProvider.STUB_TOKEN) {
      return { userId: StubAuthProvider.STUB_USER_ID };
    }

    const userId = this.userIdByToken.get(token);
    if (!userId) {
      throw new InvalidEntityDataException(
        `StubAuthProvider: token desconocido "${token}"`,
      );
    }

    return { userId };
  }

  public async deleteUser(userId: string): Promise<void> {
    for (const [email, id] of this.userIdByEmail.entries()) {
      if (id === userId) {
        this.userIdByEmail.delete(email);
        this.registeredEmails.delete(email);
      }
    }
    for (const [token, id] of this.userIdByToken.entries()) {
      if (id === userId) this.userIdByToken.delete(token);
    }
    this.emailConfirmedUserIds.delete(userId);
  }

  public async requestPasswordReset(email: string): Promise<void> {
    this.resetEmailsSent.push(email);
  }

  public async updatePassword(
    userId: string,
    newPassword: string,
  ): Promise<void> {
    this.passwordUpdates.push({ userId, newPassword });
  }

  public async resendSignupOtp(email: string): Promise<void> {
    if (!this.userIdByEmail.has(email)) {
      throw new InvalidEntityDataException(`Email not registered: ${email}`);
    }
    this.signupOtpsSent.push(email);
  }

  public async verifySignupOtp(
    email: string,
    token: string,
  ): Promise<{ userId: string }> {
    const userId = this.userIdByEmail.get(email);
    if (!userId) {
      throw new InvalidEntityDataException(`Email not registered: ${email}`);
    }
    if (token !== StubAuthProvider.STUB_OTP) {
      throw new InvalidEntityDataException('Invalid OTP');
    }
    this.emailConfirmedUserIds.add(userId);
    return { userId };
  }

  public async getEmailVerificationStatus(userId: string): Promise<boolean> {
    return this.emailConfirmedUserIds.has(userId);
  }
}
