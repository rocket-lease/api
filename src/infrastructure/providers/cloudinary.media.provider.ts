import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import type { MediaProvider } from '@/domain/providers/media.provider';

@Injectable()
export class CloudinaryMediaProvider implements MediaProvider {
  private isConfigured = false;

  private ensureConfigured() {
    if (this.isConfigured) return;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Missing Cloudinary credentials');
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    this.isConfigured = true;
  }

  async uploadAvatar(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    this.ensureConfigured();

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: 'rocket-lease/avatars',
          resource_type: 'image',
          public_id: `${Date.now()}-${file.originalname}`,
        },
        (error, result) => {
          if (error || !result?.secure_url) {
            return reject(error instanceof Error ? error : new Error('Cloudinary upload failed'));
          }
          resolve(result.secure_url);
        },
      );

      upload.end(file.buffer);
    });
  }
}
