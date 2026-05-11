export interface AuthProvider {
  signUp(email: string, password: string): Promise<{ userId: string }>;
  signIn(
    email: string,
    password: string,
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export const AUTH_PROVIDER = Symbol('AuthProvider');
