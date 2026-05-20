import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import type { MediaProvider, SignedUpload } from '@/domain/providers/media.provider';

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

  async signUpload(opts: { folder?: string; resourceType?: 'image' | 'video' }): Promise<SignedUpload> {
    this.ensureConfigured();

    const folder = opts.folder ?? 'rocket-lease/vehicle-photos';
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign: Record<string, string> = {
      folder,
      timestamp: String(timestamp),
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!,
    );

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME!}/${opts.resourceType ?? 'image'}/upload`,
      fields: {
        ...paramsToSign,
        api_key: process.env.CLOUDINARY_API_KEY!,
        signature,
      },
    };
  }

  async deleteAsset(publicId: string): Promise<void> {
    this.ensureConfigured();
    await cloudinary.uploader.destroy(publicId);
  }
}
