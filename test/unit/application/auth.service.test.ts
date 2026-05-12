import { AuthService } from '@/application/auth.service';
import { VerificationService } from '@/application/verification.service';
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
  let verificationServiceMock: jest.Mocked<
    Pick<VerificationService, 'sendOtpsAfterRegister'>
  >;

  beforeEach(() => {
    userRepoMock = {
      save: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      markEmailVerified: jest.fn(),
      markPhoneVerified: jest.fn(),
      getVerificationStatus: jest
        .fn()
        .mockResolvedValue({ email: false, phone: false }),
    };
    authProviderMock = {
      signUp: jest.fn().mockResolvedValue({ userId: 'stub-id' }),
      signIn: jest.fn().mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
      }),
      verifyToken: jest.fn().mockResolvedValue({ userId: 'stub-id' }),
    };
    verificationServiceMock = {
      sendOtpsAfterRegister: jest.fn().mockResolvedValue(undefined),
    };
    service = new AuthService(
      userRepoMock,
      authProviderMock,
      verificationServiceMock as unknown as VerificationService,
    );
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

  it('triggers OTP send after successful register', async () => {
    await service.register(validDto);
    expect(verificationServiceMock.sendOtpsAfterRegister).toHaveBeenCalledWith(
      'stub-id',
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
    expect(verificationServiceMock.sendOtpsAfterRegister).not.toHaveBeenCalled();
  });
});
