import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { AuthProvider } from '@/domain/providers/auth.provider';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';

@Injectable()
export class SupabaseAuthProvider implements AuthProvider {
  private readonly supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
}
