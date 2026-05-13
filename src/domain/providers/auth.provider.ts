export interface AuthProvider {
  signUp(email: string, password: string): Promise<{ userId: string }>;
  signIn(
    email: string,
    password: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
  verifyToken(token: string): Promise<{ userId: string }>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  resendSignupOtp(email: string): Promise<void>;
  verifySignupOtp(email: string, token: string): Promise<{ userId: string }>;
  getEmailVerificationStatus(userId: string): Promise<boolean>;
}

export const AUTH_PROVIDER = Symbol('AuthProvider');
