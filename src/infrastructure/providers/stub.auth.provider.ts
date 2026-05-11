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
}
