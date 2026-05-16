import { VerificationService } from '@/application/verification.service';
import { AuthProvider } from '@/domain/providers/auth.provider';
import { UserRepository } from '@/domain/repositories/user.repository';
import { User } from '@/domain/entities/user.entity';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';

describe('VerificationService', () => {
  let service: VerificationService;
  let authProviderMock: jest.Mocked<AuthProvider>;
  let userRepoMock: jest.Mocked<UserRepository>;

  beforeEach(() => {
    authProviderMock = {
      signUp: jest.fn(),
      signIn: jest.fn(),
      verifyToken: jest.fn(),
      requestPasswordReset: jest.fn(),
      updatePassword: jest.fn(),
      deleteUser: jest.fn(),
      resendSignupOtp: jest.fn().mockResolvedValue(undefined),
      verifySignupOtp: jest.fn().mockResolvedValue({ userId: 'user-1' }),
      getEmailVerificationStatus: jest.fn().mockResolvedValue(false),
    };
    userRepoMock = {
      save: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      getProfileById: jest.fn(),
      findProfilesByIds: jest.fn().mockResolvedValue([]),
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      updateBasicInfo: jest.fn(),
      deleteById: jest.fn(),
      markPhoneVerified: jest.fn().mockResolvedValue(undefined),
      isPhoneVerified: jest.fn().mockResolvedValue(false),
    };
    service = new VerificationService(authProviderMock, userRepoMock);
  });

  describe('resendEmailOtp', () => {
    it('delegates to authProvider.resendSignupOtp', async () => {
      await service.resendEmailOtp('a@b.com');
      expect(authProviderMock.resendSignupOtp).toHaveBeenCalledWith('a@b.com');
    });
  });

  describe('verifyEmailOtp', () => {
    it('delegates to authProvider.verifySignupOtp', async () => {
      await service.verifyEmailOtp('a@b.com', '123456');
      expect(authProviderMock.verifySignupOtp).toHaveBeenCalledWith(
        'a@b.com',
        '123456',
      );
    });
  });

  describe('verifyPhoneOtp', () => {
    it('marks phone verified for existing user', async () => {
      userRepoMock.findById.mockResolvedValue(
        new User(
          'user-1',
          'Juan',
          'juan@example.com',
          '12345678',
          '1123456789',
        ),
      );
      await service.verifyPhoneOtp('user-1', '654321');
      expect(userRepoMock.markPhoneVerified).toHaveBeenCalledWith(
        'user-1',
        expect.any(Date),
      );
    });

    it('throws when user does not exist', async () => {
      userRepoMock.findById.mockResolvedValue(null);
      await expect(service.verifyPhoneOtp('missing', '654321')).rejects.toThrow(
        InvalidEntityDataException,
      );
      expect(userRepoMock.markPhoneVerified).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('combines email + phone status', async () => {
      authProviderMock.getEmailVerificationStatus.mockResolvedValue(true);
      userRepoMock.isPhoneVerified.mockResolvedValue(false);
      const status = await service.getStatus('user-1');
      expect(status).toEqual({ email: true, phone: false });
    });
  });
});
