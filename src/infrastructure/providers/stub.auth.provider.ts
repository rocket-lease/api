import { AuthProvider } from '@/domain/providers/auth.provider';

export class StubAuthProvider implements AuthProvider {
  private readonly registeredEmails = new Set<string>();

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
      access_token: 'stub-access-token',
      refresh_token: 'stub-refresh-token',
      expires_in: 3600,
    };
  }
}
