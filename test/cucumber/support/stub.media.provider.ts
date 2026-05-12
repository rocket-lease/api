import type { MediaProvider } from '@/domain/providers/media.provider';

export class StubMediaProvider implements MediaProvider {
  public async uploadAvatar(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    const safeName = file.originalname.replace(/\s+/g, '-').toLowerCase();
    return `https://stub-cloudinary.local/avatars/${Date.now()}-${safeName}`;
  }
}
