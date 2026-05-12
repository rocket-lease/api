export interface MediaProvider {
  uploadAvatar(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string>;
}

export const MEDIA_PROVIDER = Symbol('MediaProvider');
