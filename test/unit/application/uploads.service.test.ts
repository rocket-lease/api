import { UploadsService } from '@/application/uploads.service';
import { MediaProvider } from '@/domain/providers/media.provider';

describe('UploadsService', () => {
  let service: UploadsService;
  let mediaProviderMock: jest.Mocked<MediaProvider>;

  beforeEach(() => {
    mediaProviderMock = {
      uploadAvatar: jest.fn(),
      signUpload: jest.fn(),
      deleteAsset: jest.fn(),
    };

    service = new UploadsService(mediaProviderMock);
  });

  describe('signUpload', () => {
    it('delegates to mediaProvider with given opts', async () => {
      const signed = {
        uploadUrl: 'https://api.cloudinary.com/v1_1/mycloud/image/upload',
        fields: { api_key: '123', timestamp: '1716000000', signature: 'abc', folder: 'rocket-lease/vehicle-photos' },
      };
      mediaProviderMock.signUpload.mockResolvedValue(signed);

      const result = await service.signUpload({ folder: 'rocket-lease/vehicle-photos', resourceType: 'image' });

      expect(mediaProviderMock.signUpload).toHaveBeenCalledWith({
        folder: 'rocket-lease/vehicle-photos',
        resourceType: 'image',
      });
      expect(result).toBe(signed);
    });

    it('passes undefined opts through', async () => {
      const signed = { uploadUrl: 'https://example.com/upload', fields: {} };
      mediaProviderMock.signUpload.mockResolvedValue(signed);

      await service.signUpload({});

      expect(mediaProviderMock.signUpload).toHaveBeenCalledWith({});
    });
  });

  describe('deleteAsset', () => {
    it('delegates publicId to mediaProvider', async () => {
      mediaProviderMock.deleteAsset.mockResolvedValue(undefined);

      await service.deleteAsset('rocket-lease/vehicle-photos/my-image');

      expect(mediaProviderMock.deleteAsset).toHaveBeenCalledWith('rocket-lease/vehicle-photos/my-image');
    });
  });
});
