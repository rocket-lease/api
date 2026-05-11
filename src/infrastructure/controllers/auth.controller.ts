import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  RegisterUserRequestSchema,
  type RegisterUserRequest,
  LoginUserRequestSchema,
  type LoginUserRequest,
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
}
