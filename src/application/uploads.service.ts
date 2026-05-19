import { Inject, Injectable } from '@nestjs/common';
import type { MediaProvider, SignedUpload } from '@/domain/providers/media.provider';
import { MEDIA_PROVIDER } from '@/domain/providers/media.provider';

@Injectable()
export class UploadsService {
  constructor(@Inject(MEDIA_PROVIDER) private readonly mediaProvider: MediaProvider) {}

  signUpload(opts: { folder?: string; resourceType?: 'image' | 'video' }): Promise<SignedUpload> {
    return this.mediaProvider.signUpload(opts);
  }

  deleteAsset(publicId: string): Promise<void> {
    return this.mediaProvider.deleteAsset(publicId);
  }
}
