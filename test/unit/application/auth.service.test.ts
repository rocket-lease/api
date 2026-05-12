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
      deleteById: jest.fn(),
    };
    authProviderMock = {
      signUp: jest.fn().mockResolvedValue({ userId: 'stub-id' }),
      signIn: jest.fn().mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
      }),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      verifyToken: jest.fn().mockResolvedValue({ userId: 'stub-id' }),
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

  describe('deleteAccount', () => {
    it('deletes user from repo and auth provider', async () => {
      const userFake = new User(
        'user-1',
        'Juan',
        'juan@example.com',
        '12345678',
        '1123456789',
      );
      userRepoMock.findById.mockResolvedValue(userFake);

      await service.deleteAccount('user-1');

      expect(userRepoMock.deleteById).toHaveBeenCalledWith('user-1');
      expect(authProviderMock.deleteUser).toHaveBeenCalledWith('user-1');
    });

    it('throws when user does not exist', async () => {
      userRepoMock.findById.mockResolvedValue(null);
      await expect(service.deleteAccount('missing')).rejects.toThrow(
        InvalidEntityDataException,
      );
      expect(userRepoMock.deleteById).not.toHaveBeenCalled();
      expect(authProviderMock.deleteUser).not.toHaveBeenCalled();
    });
  });
});
