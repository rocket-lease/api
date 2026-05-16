import { ProfileService } from '@/application/profile.service';
import { UserRepository } from '@/domain/repositories/user.repository';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';
import { MediaProvider } from '@/domain/providers/media.provider';

describe('ProfileService', () => {
  let service: ProfileService;
  let userRepoMock: jest.Mocked<UserRepository>;
  let mediaProviderMock: jest.Mocked<MediaProvider>;

  beforeEach(() => {
    userRepoMock = {
      save: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      getProfileById: jest.fn().mockResolvedValue(null),
      getProfilesByIds: jest.fn().mockResolvedValue([]),
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      updateBasicInfo: jest.fn(),
      deleteById: jest.fn(),
      markPhoneVerified: jest.fn(),
      isPhoneVerified: jest.fn().mockResolvedValue(false),
    };
    mediaProviderMock = {
      uploadAvatar: jest.fn(),
    };

    service = new ProfileService(userRepoMock, mediaProviderMock);
  });

  it('returns profile data when user exists', async () => {
    userRepoMock.getProfileById.mockResolvedValue({
      id: 'user-1',
      name: 'Juan Perez',
      email: 'juan@example.com',
      phone: '1123456789',
      avatarUrl: null,
      verificationStatus: 'verified',
      level: 'silver',
      reputationScore: 4.5,
      preferences: {
        transmission: 'automatic',
        accessibility: ['movilidad-reducida'],
        maxPriceDaily: 1000000,
      },
    });

    const profile = await service.getMyProfile('user-1');
    expect(profile.id).toBe('user-1');
    expect(profile.preferences.transmission).toBe('automatic');
  });

  it('throws when profile does not exist', async () => {
    await expect(service.getMyProfile('missing')).rejects.toThrow(
      InvalidEntityDataException,
    );
  });

  it('updates and returns profile data', async () => {
    userRepoMock.findById.mockResolvedValue({
      getId: () => 'user-1',
      getName: () => 'Juan',
      getEmail: () => 'juan@example.com',
      getDni: () => '12345678',
      getPhone: () => '1123456789',
    } as any);

    userRepoMock.updateProfile.mockResolvedValue({
      id: 'user-1',
      name: 'Juan Actualizado',
      email: 'juan@example.com',
      phone: '1199999999',
      avatarUrl: 'https://cdn.example.com/avatar.jpg',
      verificationStatus: 'verified',
      level: 'gold',
      reputationScore: 4.9,
      preferences: {
        transmission: null,
        accessibility: [],
        maxPriceDaily: null,
      },
    });

    const updated = await service.updateMyProfile('user-1', {
      name: 'Juan Actualizado',
      phone: '1199999999',
      avatarUrl: 'https://cdn.example.com/avatar.jpg',
      preferences: {
        transmission: null,
        accessibility: [],
        maxPriceDaily: null,
      },
    });

    expect(updated.name).toBe('Juan Actualizado');
    expect(userRepoMock.updateProfile).toHaveBeenCalledTimes(1);
  });

  it('uploads avatar and persists only avatar field', async () => {
    userRepoMock.findById.mockResolvedValue({
      getId: () => 'user-1',
      getName: () => 'Juan',
      getEmail: () => 'juan@example.com',
      getDni: () => '12345678',
      getPhone: () => '1123456789',
    } as any);

    mediaProviderMock.uploadAvatar.mockResolvedValue(
      'https://cdn.example.com/avatar-nuevo.jpg',
    );

    userRepoMock.updateAvatar.mockResolvedValue({
      id: 'user-1',
      name: 'Juan',
      email: 'juan@example.com',
      phone: '1123456789',
      avatarUrl: 'https://cdn.example.com/avatar-nuevo.jpg',
      verificationStatus: 'verified',
      level: 'gold',
      reputationScore: 4.9,
      preferences: {
        transmission: null,
        accessibility: [],
        maxPriceDaily: null,
      },
    });

    const updated = await service.updateAvatar('user-1', {
      buffer: Buffer.from('fake-image'),
      originalname: 'avatar.jpg',
      mimetype: 'image/jpeg',
    });

    expect(mediaProviderMock.uploadAvatar).toHaveBeenCalledTimes(1);
    expect(userRepoMock.updateAvatar).toHaveBeenCalledWith(
      'user-1',
      'https://cdn.example.com/avatar-nuevo.jpg',
    );
    expect(updated.avatarUrl).toBe('https://cdn.example.com/avatar-nuevo.jpg');
  });
});
