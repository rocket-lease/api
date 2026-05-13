import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  RegisterUserRequestSchema,
  type RegisterUserRequest,
  LoginUserRequestSchema,
  type LoginUserRequest,
  ForgotPasswordRequestSchema,
  type ForgotPasswordRequest,
  ResetPasswordRequestSchema,
  type ResetPasswordRequest,
} from '@rocket-lease/contracts';

import { AuthService } from '@/application/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  public async register(@Body() body: RegisterUserRequest) {
    const dto = RegisterUserRequestSchema.parse(body);
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(201)
  public async login(@Body() body: LoginUserRequest) {
    const dto = LoginUserRequestSchema.parse(body);
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  public async forgotPassword(@Body() body: ForgotPasswordRequest) {
    const dto = ForgotPasswordRequestSchema.parse(body);
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  public async resetPassword(@Body() body: ResetPasswordRequest) {
    const dto = ResetPasswordRequestSchema.parse(body);
    return this.authService.resetPassword(dto);
  }
}
