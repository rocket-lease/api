import { AuthProvider } from '@/domain/providers/auth.provider';

export class StubAuthProvider implements AuthProvider {
  static readonly STUB_TOKEN = 'stub-access-token';
  static readonly STUB_USER_ID = 'stub-user-id';

  private readonly registeredEmails = new Set<string>();
  private readonly userIdByEmail = new Map<string, string>();
  private readonly userIdByToken = new Map<string, string>();

  public async signUp(
    email: string,
    _password: string,
  ): Promise<{ userId: string }> {
    if (this.registeredEmails.has(email)) {
      throw new Error('Email already registered in auth provider');
    }
    this.registeredEmails.add(email);
    const userId = `stub-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.userIdByEmail.set(email, userId);
    return { userId };
  }

  public async signIn(
    email: string,
    _password: string,
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
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
      throw new Error(`StubAuthProvider: token desconocido "${token}"`);
    }

    return { userId };
  }
}
