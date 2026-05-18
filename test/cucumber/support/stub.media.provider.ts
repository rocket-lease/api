import type { MediaProvider, SignedUpload } from '@/domain/providers/media.provider';

export class StubMediaProvider implements MediaProvider {
  public async uploadAvatar(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    const safeName = file.originalname.replace(/\s+/g, '-').toLowerCase();
    return `https://stub-cloudinary.local/avatars/${Date.now()}-${safeName}`;
  }

  public async signUpload(opts: { folder?: string; resourceType?: 'image' | 'video' }): Promise<SignedUpload> {
    return {
      uploadUrl: 'https://stub-cloudinary.local/upload',
      fields: {
        api_key: 'stub-key',
        timestamp: String(Math.floor(Date.now() / 1000)),
        signature: 'stub-signature',
        folder: opts.folder ?? 'rocket-lease/vehicle-photos',
      },
    };
  }

  public async deleteAsset(_publicId: string): Promise<void> {
    // no-op in tests
  }
}
