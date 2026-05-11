import { AuthService } from '@/application/auth.service';
import { User } from '@/domain/entities/user.entity';
import { EntityAlreadyExistsException } from '@/domain/exceptions/domain.exception';
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
    };
    authProviderMock = {
      signUp: jest.fn().mockResolvedValue({ userId: 'stub-id' }),
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
});
