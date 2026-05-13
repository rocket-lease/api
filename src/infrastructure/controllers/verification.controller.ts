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
  ResendEmailOtpRequestSchema,
  type ResendEmailOtpRequest,
  VerifyEmailOtpRequestSchema,
  type VerifyEmailOtpRequest,
  VerifyPhoneOtpRequestSchema,
  type VerifyPhoneOtpRequest,
} from '@rocket-lease/contracts';
import { AuthService } from '@/application/auth.service';
import { VerificationService } from '@/application/verification.service';

@Controller('verifications')
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly authService: AuthService,
  ) {}

  private async resolveUserId(authorization?: string): Promise<string> {
    if (!authorization) throw new UnauthorizedException('Missing authorization header');
    try {
      return await this.authService.getUserIdFromToken(authorization);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  @Post('email/resend')
  @HttpCode(204)
  public async resendEmailOtp(@Body() body: ResendEmailOtpRequest) {
    const dto = ResendEmailOtpRequestSchema.parse(body);
    await this.verificationService.resendEmailOtp(dto.email);
  }

  @Post('email/verify')
  @HttpCode(204)
  public async verifyEmailOtp(@Body() body: VerifyEmailOtpRequest) {
    const dto = VerifyEmailOtpRequestSchema.parse(body);
    await this.verificationService.verifyEmailOtp(dto.email, dto.token);
  }

  @Post('phone/verify')
  @HttpCode(204)
  public async verifyPhoneOtp(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: VerifyPhoneOtpRequest,
  ) {
    const userId = await this.resolveUserId(authorization);
    const dto = VerifyPhoneOtpRequestSchema.parse(body);
    await this.verificationService.verifyPhoneOtp(userId, dto.token);
  }

  @Get('status')
  @HttpCode(200)
  public async getStatus(
    @Headers('authorization') authorization: string | undefined,
  ) {
    const userId = await this.resolveUserId(authorization);
    return this.verificationService.getStatus(userId);
  }
}
