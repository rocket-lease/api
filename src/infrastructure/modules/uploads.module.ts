import { Module } from '@nestjs/common';
import { UploadsService } from '@/application/uploads.service';
import { UploadsController } from '@/infrastructure/controllers/uploads.controller';
import { MEDIA_PROVIDER } from '@/domain/providers/media.provider';
import { CloudinaryMediaProvider } from '@/infrastructure/providers/cloudinary.media.provider';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UploadsController],
  providers: [
    UploadsService,
    { provide: MEDIA_PROVIDER, useClass: CloudinaryMediaProvider },
  ],
})
export class UploadsModule {}
