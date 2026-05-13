import { Module } from '@nestjs/common';
import { AuthService } from '@/application/auth.service';
import { ProfileService } from '@/application/profile.service';
import { ProfileController } from '@/infrastructure/controllers/profile.controller';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PostgresUserRepository } from '@/infrastructure/repository/postgres.user.repository';
import { SupabaseAuthProvider } from '@/infrastructure/providers/supabase.auth.provider';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { AUTH_PROVIDER } from '@/domain/providers/auth.provider';
import { MEDIA_PROVIDER } from '@/domain/providers/media.provider';
import { CloudinaryMediaProvider } from '@/infrastructure/providers/cloudinary.media.provider';

@Module({
  controllers: [ProfileController],
  providers: [
    AuthService,
    ProfileService,
    PrismaService,
    { provide: USER_REPOSITORY, useClass: PostgresUserRepository },
    { provide: AUTH_PROVIDER, useClass: SupabaseAuthProvider },
    { provide: MEDIA_PROVIDER, useClass: CloudinaryMediaProvider },
  ],
})
export class ProfileModule {}
