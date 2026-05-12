import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SendOtpRequestSchema,
  type SendOtpRequest,
  VerifyOtpRequestSchema,
  type VerifyOtpRequest,
} from '@rocket-lease/contracts';
import { AuthService } from '@/application/auth.service';
import { VerificationService } from '@/application/verification.service';

@Controller('verifications')
export class VerificationController {
  constructor(
    private readonly authService: AuthService,
    private readonly verificationService: VerificationService,
  ) {}

  @Post('send')
  @HttpCode(200)
  public async send(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: SendOtpRequest,
  ) {
    const userId = await this.requireUser(authorization);
    const dto = SendOtpRequestSchema.parse(body);
    return this.verificationService.sendOtp(userId, dto.channel);
  }

  @Post('verify')
  @HttpCode(200)
  public async verify(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: VerifyOtpRequest,
  ) {
    const userId = await this.requireUser(authorization);
    const dto = VerifyOtpRequestSchema.parse(body);
    return this.verificationService.verifyOtp(userId, dto.channel, dto.code);
  }

  @Get('status')
  public async status(
    @Headers('authorization') authorization: string | undefined,
  ) {
    const userId = await this.requireUser(authorization);
    return this.verificationService.getStatus(userId);
  }

  private async requireUser(
    authorization: string | undefined,
  ): Promise<string> {
    if (!authorization) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    try {
      return await this.authService.getUserIdFromToken(authorization);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
