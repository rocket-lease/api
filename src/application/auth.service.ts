import { Inject, Injectable } from '@nestjs/common';
import {
  type RegisterUserRequest,
  type RegisterUserResponse,
  RegisterUserResponseSchema,
  type LoginUserRequest,
  type LoginUserResponse,
  LoginUserResponseSchema,
  type ForgotPasswordRequest,
  type ForgotPasswordResponse,
  ForgotPasswordResponseSchema,
  type ResetPasswordRequest,
  type ResetPasswordResponse,
  ResetPasswordResponseSchema,
} from '@rocket-lease/contracts';
import { User } from '@/domain/entities/user.entity';
import { EntityAlreadyExistsException } from '@/domain/exceptions/domain.exception';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import type { AuthProvider } from '@/domain/providers/auth.provider';
import { AUTH_PROVIDER } from '@/domain/providers/auth.provider';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(AUTH_PROVIDER) private readonly authProvider: AuthProvider,
  ) {}

  public async register(
    dto: RegisterUserRequest,
  ): Promise<RegisterUserResponse> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) throw new EntityAlreadyExistsException('user', dto.email);

    const { userId } = await this.authProvider.signUp(dto.email, dto.password);
    const user = new User(userId, dto.name, dto.email, dto.dni, dto.phone);
    await this.userRepository.save(user);

    return RegisterUserResponseSchema.parse({
      id: user.getId(),
      name: user.getName(),
      email: user.getEmail(),
    });
  }

  public async login(dto: LoginUserRequest): Promise<LoginUserResponse> {
    const authData = await this.authProvider.signIn(dto.email, dto.password);
    return LoginUserResponseSchema.parse(authData);
  }

  public async getUserIdFromToken(token: string): Promise<string> {
    const rawToken = token.startsWith('Bearer ')
      ? token.slice('Bearer '.length)
      : token;
    const { userId } = await this.authProvider.verifyToken(rawToken);
    return userId;
  }

  public async forgotPassword(
    dto: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResponse> {
    await this.authProvider.requestPasswordReset(dto.email);
    return ForgotPasswordResponseSchema.parse({
      message: 'If the email exists, a reset link has been sent',
    });
  }

  public async resetPassword(
    dto: ResetPasswordRequest,
  ): Promise<ResetPasswordResponse> {
    const { userId } = await this.authProvider.verifyToken(dto.accessToken);
    await this.authProvider.updatePassword(userId, dto.newPassword);
    return ResetPasswordResponseSchema.parse({
      message: 'Password updated successfully',
    });
  }
}
