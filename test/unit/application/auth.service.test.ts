import { AuthService } from '@/application/auth.service';
import { User } from '@/domain/entities/user.entity';
import {
  EntityAlreadyExistsException,
  InvalidEntityDataException,
} from '@/domain/exceptions/domain.exception';
import { UserRepository } from '@/domain/repositories/user.repository';
import { AuthProvider } from '@/domain/providers/auth.provider';

const validDto = {
  name: 'Juan Pérez',
  email: 'juan@example.com',
  dni: '12345678',
  phone: '1123456789',
  password: 'Passw0rd!',
};

describe('AuthService', () => {
  let service: AuthService;
  let userRepoMock: jest.Mocked<UserRepository>;
  let authProviderMock: jest.Mocked<AuthProvider>;

  beforeEach(() => {
    userRepoMock = {
      save: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      getProfileById: jest.fn().mockResolvedValue(null),
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      updateBasicInfo: jest.fn(),
      deleteById: jest.fn(),
      markPhoneVerified: jest.fn(),
      isPhoneVerified: jest.fn().mockResolvedValue(false),
      findProfilesByIds: jest.fn().mockResolvedValue([]),
    };
    authProviderMock = {
      signUp: jest.fn().mockResolvedValue({ userId: 'stub-id' }),
      signIn: jest.fn().mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
      }),
      verifyToken: jest.fn().mockResolvedValue({ userId: 'stub-id' }),
      requestPasswordReset: jest.fn().mockResolvedValue(undefined),
      updatePassword: jest.fn().mockResolvedValue(undefined),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      getEmailVerificationStatus: jest.fn().mockResolvedValue(true),
      resendSignupOtp: jest.fn().mockResolvedValue(undefined),
      verifySignupOtp: jest.fn().mockResolvedValue({ userId: 'stub-id' }),
    };
    service = new AuthService(userRepoMock, authProviderMock);
  });

  it('registers a user with valid data', async () => {
    const result = await service.register(validDto);
    expect(result.email).toBe(validDto.email);
    expect(result.id).toBe('stub-id');
    expect(userRepoMock.save).toHaveBeenCalledWith(expect.any(User));
    expect(authProviderMock.signUp).toHaveBeenCalledWith(
      validDto.email,
      validDto.password,
    );
  });

  it('throws EntityAlreadyExistsException when email already exists', async () => {
    const existing = new User(
      'x',
      'Otro',
      validDto.email,
      '87654321',
      '1199999999',
    );
    userRepoMock.findByEmail.mockResolvedValue(existing);
    await expect(service.register(validDto)).rejects.toThrow(
      EntityAlreadyExistsException,
    );
  });

  it('does not call authProvider.signUp when email already exists', async () => {
    const existing = new User(
      'x',
      'Otro',
      validDto.email,
      '87654321',
      '1199999999',
    );
    userRepoMock.findByEmail.mockResolvedValue(existing);
    await expect(service.register(validDto)).rejects.toThrow();
    expect(authProviderMock.signUp).not.toHaveBeenCalled();
  });

  describe('forgotPassword', () => {
    it('delegates to authProvider.requestPasswordReset', async () => {
      const result = await service.forgotPassword({ email: 'a@b.com' });
      expect(authProviderMock.requestPasswordReset).toHaveBeenCalledWith(
        'a@b.com',
      );
      expect(result.message).toBeDefined();
    });

    it('returns generic message regardless of email existence', async () => {
      const r1 = await service.forgotPassword({ email: 'exists@b.com' });
      const r2 = await service.forgotPassword({ email: 'missing@b.com' });
      expect(r1.message).toBe(r2.message);
    });
  });

  describe('resetPassword', () => {
    const dto = { accessToken: 'token-x', newPassword: 'Newp4ss!' };

    it('verifies token and updates password', async () => {
      authProviderMock.verifyToken.mockResolvedValue({ userId: 'user-1' });
      const result = await service.resetPassword(dto);
      expect(authProviderMock.verifyToken).toHaveBeenCalledWith(
        dto.accessToken,
      );
      expect(authProviderMock.updatePassword).toHaveBeenCalledWith(
        'user-1',
        dto.newPassword,
      );
      expect(result.message).toBeDefined();
    });

    it('throws when token is invalid', async () => {
      authProviderMock.verifyToken.mockRejectedValue(
        new Error('Token inválido'),
      );
      await expect(service.resetPassword(dto)).rejects.toThrow();
      expect(authProviderMock.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('deletes user from repo and auth provider', async () => {
      await service.deleteAccount('user-1');

      expect(userRepoMock.deleteById).toHaveBeenCalledWith('user-1');
      expect(authProviderMock.deleteUser).toHaveBeenCalledWith('user-1');
    });

    it('propagates repo errors and skips auth provider', async () => {
      userRepoMock.deleteById.mockRejectedValue(
        new InvalidEntityDataException('User not found'),
      );
      await expect(service.deleteAccount('missing')).rejects.toThrow(
        InvalidEntityDataException,
      );
      expect(authProviderMock.deleteUser).not.toHaveBeenCalled();
    });
  });
});
