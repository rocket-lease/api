import { AuthProvider } from '@/domain/providers/auth.provider';
import { randomUUID } from 'node:crypto';

export class StubAuthProvider implements AuthProvider {
  static readonly STUB_TOKEN = randomUUID();
  static readonly STUB_USER_ID = '00000000-0000-0000-0000-000000000001';

  private readonly registeredEmails = new Set<string>();

  public async signUp(
    email: string,
    _password: string,
  ): Promise<{ userId: string }> {
    if (this.registeredEmails.has(email)) {
      throw new Error('Email already registered in auth provider');
    }
      this.registeredEmails.add(email);
      return { userId: StubAuthProvider.STUB_USER_ID };
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
      throw new Error(`StubAuthProvider: token desconocido "${token}"`);
    }
    return { userId: StubAuthProvider.STUB_USER_ID };
  }
}
