import {
  BadRequestException,
  Headers,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UploadedFiles,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthService } from '@/application/auth.service';
import { DriverLicenseService } from '@/application/driver-license.service';
import type { SubmitDriverLicenseVerificationRequest } from '@rocket-lease/contracts';

type UploadedIdentityFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

function fileToDocument(file: UploadedIdentityFile) {
  return {
    fileName: file.originalname,
    mimeType: file.mimetype,
    dataUrl: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
  };
}

@Controller('driver-license')
export class DriverLicenseController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(DriverLicenseService) private readonly driverLicenseService: DriverLicenseService,
  ) {}

  private async resolveUserId(authorization?: string): Promise<string> {
    if (!authorization) {
      throw new UnauthorizedException('Missing authorization header');
    }

    try {
      return await this.authService.getUserIdFromToken(authorization);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  @Get('me/verification')
  @HttpCode(200)
  public async getMyVerification(
    @Headers('authorization') authorization: string | undefined,
  ) {
    const userId = await this.resolveUserId(authorization);
    return this.driverLicenseService.getMyVerification(userId);
  }

  @Post('me/verification')
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'frontLicense', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
      ],
      {
        limits: { fileSize: 5 * 1024 * 1024, files: 2 },
      },
    ),
  )
  public async submitMyVerification(
    @Headers('authorization') authorization: string | undefined,
    @UploadedFiles()
    files: {
      frontLicense?: UploadedIdentityFile[];
      selfie?: UploadedIdentityFile[];
    },
  ) {
    const userId = await this.resolveUserId(authorization);

    const frontLicense = files.frontLicense?.[0];
    const selfie = files.selfie?.[0];

    if (!frontLicense || !selfie) {
      throw new BadRequestException('Missing driver license verification files');
    }

    const dto: SubmitDriverLicenseVerificationRequest = {
      frontLicense: fileToDocument(frontLicense),
      selfie: fileToDocument(selfie),
    };

    return this.driverLicenseService.submitMyVerification(userId, dto);
  }
}