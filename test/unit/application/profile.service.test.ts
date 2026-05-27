import { ProfileService } from '@/application/profile.service';
import { UserRepository } from '@/domain/repositories/user.repository';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';
import { MediaProvider } from '@/domain/providers/media.provider';
import { IdentityService } from '@/application/identity.service';
import { DriverLicenseService } from '@/application/driver-license.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let userRepoMock: jest.Mocked<UserRepository>;
  let mediaProviderMock: jest.Mocked<MediaProvider>;
  let identityServiceMock: jest.Mocked<Pick<IdentityService, 'getSummaryByUserId'>>;
  let driverLicenseServiceMock: jest.Mocked<Pick<DriverLicenseService, 'getSummaryByUserId'>>;

  beforeEach(() => {
    userRepoMock = {
      save: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      getProfileById: jest.fn().mockResolvedValue(null),
      findProfilesByIds: jest.fn().mockResolvedValue([]),
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      creditBalance: jest.fn(),
      updateBasicInfo: jest.fn(),
      deleteById: jest.fn(),
      markPhoneVerified: jest.fn(),
      isPhoneVerified: jest.fn().mockResolvedValue(false),
      updateAutoAccept: jest.fn(),
    };
    mediaProviderMock = {
      uploadAvatar: jest.fn(),
      signUpload: jest.fn(),
      deleteAsset: jest.fn(),
    };
    identityServiceMock = {
      getSummaryByUserId: jest.fn().mockResolvedValue({
        status: 'verified',
        providerName: 'stub-identity-provider',
        providerRequestId: 'req-1',
        rejectionReason: null,
        submittedAt: '2026-05-25T12:00:00.000Z',
        reviewAfterAt: '2026-05-25T12:00:30.000Z',
        reviewedAt: '2026-05-25T12:00:30.000Z',
        verifiedAt: '2026-05-25T12:00:30.000Z',
      }),
    };
    driverLicenseServiceMock = {
      getSummaryByUserId: jest.fn().mockResolvedValue({
        status: 'not_started',
        providerName: null,
        providerRequestId: null,
        rejectionReason: null,
        submittedAt: null,
        reviewAfterAt: null,
        reviewedAt: null,
        verifiedAt: null,
      }),
    };

    service = new ProfileService(
      userRepoMock,
      mediaProviderMock,
      identityServiceMock as unknown as IdentityService,
      driverLicenseServiceMock as unknown as DriverLicenseService,
    );
  });

  it('returns profile data when user exists', async () => {
    userRepoMock.getProfileById.mockResolvedValue({
      id: 'user-1',
      name: 'Juan Perez',
      email: 'juan@example.com',
      phone: '1123456789',
      avatarUrl: null,
      verificationStatus: 'verified',
      identityVerification: {
        status: 'verified',
        providerName: 'stub-identity-provider',
        providerRequestId: 'req-1',
        rejectionReason: null,
        submittedAt: '2026-05-25T12:00:00.000Z',
        reviewAfterAt: '2026-05-25T12:00:30.000Z',
        reviewedAt: '2026-05-25T12:00:30.000Z',
        verifiedAt: '2026-05-25T12:00:30.000Z',
      },
      driverLicenseVerification: {
        status: 'not_started',
        providerName: null,
        providerRequestId: null,
        rejectionReason: null,
        submittedAt: null,
        reviewAfterAt: null,
        reviewedAt: null,
        verifiedAt: null,
      },
      level: 'silver',
      reputationScore: 4.5,
      balanceInCents: 125000,
      preferences: {
        transmission: 'automatic',
        accessibility: ['movilidad-reducida'],
        maxPriceDaily: 1000000,
      },
      autoAccept: false,
    } as any);

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
      identityVerification: {
        status: 'verified',
        providerName: 'stub-identity-provider',
        providerRequestId: 'req-1',
        rejectionReason: null,
        submittedAt: '2026-05-25T12:00:00.000Z',
        reviewAfterAt: '2026-05-25T12:00:30.000Z',
        reviewedAt: '2026-05-25T12:00:30.000Z',
        verifiedAt: '2026-05-25T12:00:30.000Z',
      },
      driverLicenseVerification: {
        status: 'not_started',
        providerName: null,
        providerRequestId: null,
        rejectionReason: null,
        submittedAt: null,
        reviewAfterAt: null,
        reviewedAt: null,
        verifiedAt: null,
      },
      level: 'gold',
      reputationScore: 4.9,
      balanceInCents: 0,
      preferences: {
        transmission: null,
        accessibility: [],
        maxPriceDaily: null,
      },
      autoAccept: false,
    } as any);

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
      identityVerification: {
        status: 'verified',
        providerName: 'stub-identity-provider',
        providerRequestId: 'req-1',
        rejectionReason: null,
        submittedAt: '2026-05-25T12:00:00.000Z',
        reviewAfterAt: '2026-05-25T12:00:30.000Z',
        reviewedAt: '2026-05-25T12:00:30.000Z',
        verifiedAt: '2026-05-25T12:00:30.000Z',
      },
      driverLicenseVerification: {
        status: 'not_started',
        providerName: null,
        providerRequestId: null,
        rejectionReason: null,
        submittedAt: null,
        reviewAfterAt: null,
        reviewedAt: null,
        verifiedAt: null,
      },
      level: 'gold',
      reputationScore: 4.9,
      balanceInCents: 0,
      preferences: {
        transmission: null,
        accessibility: [],
        maxPriceDaily: null,
      },
      autoAccept: false,
    } as any);

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
