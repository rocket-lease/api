export interface AuthProvider {
  signUp(email: string, password: string): Promise<{ userId: string }>;
}

export const AUTH_PROVIDER = Symbol('AuthProvider');
