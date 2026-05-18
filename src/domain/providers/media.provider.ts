export interface SignedUpload {
  uploadUrl: string;
  fields: Record<string, string>;
}

export interface MediaProvider {
  uploadAvatar(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string>;
  signUpload(opts: { folder?: string; resourceType?: 'image' | 'video' }): Promise<SignedUpload>;
  deleteAsset(publicId: string): Promise<void>;
}

export const MEDIA_PROVIDER = Symbol('MediaProvider');
