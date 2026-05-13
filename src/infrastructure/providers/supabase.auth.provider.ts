import { Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthProvider } from '@/domain/providers/auth.provider';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';

@Injectable()
export class SupabaseAuthProvider implements AuthProvider {
  private readonly logger = new Logger(SupabaseAuthProvider.name);

  private readonly supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  private readonly jwks = createRemoteJWKSet(
    new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
  );

  async signUp(email: string, password: string): Promise<{ userId: string }> {
    const { data, error } = await this.supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new InvalidEntityDataException(error.message);
    return { userId: data.user.id };
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw new InvalidEntityDataException(error.message);
    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    };
  }

  async verifyToken(token: string): Promise<{ userId: string }> {
    try {
      const { payload } = await jwtVerify(token, this.jwks);
      if (!payload.sub) throw new InvalidEntityDataException('Token sin sub claim');
      return { userId: payload.sub };
    } catch (err) {
      if (err instanceof InvalidEntityDataException) throw err;
      throw new InvalidEntityDataException(
        err instanceof Error ? err.message : 'Token inválido',
      );
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const redirectTo = process.env.PASSWORD_RESET_REDIRECT_URL;
    const { error } = await this.supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) {
      this.logger.warn(
        `resetPasswordForEmail failed for ${email}: ${error.message}`,
      );
    }
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const { error } = await this.supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (error) throw new InvalidEntityDataException(error.message);
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.supabase.auth.admin.deleteUser(userId);
    if (error) throw new InvalidEntityDataException(error.message);
  }
}
