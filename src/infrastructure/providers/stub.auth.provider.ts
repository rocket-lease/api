import { AuthProvider } from '@/domain/providers/auth.provider';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';

export class StubAuthProvider implements AuthProvider {
  static readonly STUB_TOKEN = 'stub-access-token';
  static readonly STUB_USER_ID = 'stub-user-id';

  private readonly registeredEmails = new Set<string>();
  public readonly resetEmailsSent: string[] = [];
  public readonly passwordUpdates: Array<{
    userId: string;
    newPassword: string;
  }> = [];

  public async signUp(
    email: string,
    _password: string,
  ): Promise<{ userId: string }> {
    if (this.registeredEmails.has(email)) {
      throw new Error('Email already registered in auth provider');
    }
    this.registeredEmails.add(email);
    return {
      userId: `stub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
  }

  public async signIn(
    _email: string,
    _password: string,
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    return {
      access_token: StubAuthProvider.STUB_TOKEN,
      refresh_token: 'stub-refresh-token',
      expires_in: 3600,
    };
  }

  public async verifyToken(token: string): Promise<{ userId: string }> {
    if (token !== StubAuthProvider.STUB_TOKEN) {
      throw new InvalidEntityDataException(`StubAuthProvider: token desconocido "${token}"`);
    }
    return { userId: StubAuthProvider.STUB_USER_ID };
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
}
