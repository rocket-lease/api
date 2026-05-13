import { Module } from '@nestjs/common';
import { ProfileService } from '@/application/profile.service';
import { ProfileController } from '@/infrastructure/controllers/profile.controller';
import { AuthModule } from './auth.module';
import { MEDIA_PROVIDER } from '@/domain/providers/media.provider';
import { CloudinaryMediaProvider } from '@/infrastructure/providers/cloudinary.media.provider';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    { provide: MEDIA_PROVIDER, useClass: CloudinaryMediaProvider },
  ],
})
export class ProfileModule {}
