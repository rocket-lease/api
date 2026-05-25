import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  UploadedFiles,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthService } from '@/application/auth.service';
import { IdentityService } from '@/application/identity.service';
import type { SubmitIdentityVerificationRequest } from '@rocket-lease/contracts';

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

@Controller('identity')
export class IdentityController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(IdentityService) private readonly identityService: IdentityService,
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
    return this.identityService.getMyVerification(userId);
  }

  @Post('me/verification')
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'frontDni', maxCount: 1 },
        { name: 'backDni', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
      ],
      {
        limits: { fileSize: 5 * 1024 * 1024, files: 3 },
      },
    ),
  )
  public async submitMyVerification(
    @Headers('authorization') authorization: string | undefined,
    @UploadedFiles()
    files: {
      frontDni?: UploadedIdentityFile[];
      backDni?: UploadedIdentityFile[];
      selfie?: UploadedIdentityFile[];
    },
  ) {
    const userId = await this.resolveUserId(authorization);

    const frontDni = files.frontDni?.[0];
    const backDni = files.backDni?.[0];
    const selfie = files.selfie?.[0];

    if (!frontDni || !backDni || !selfie) {
      throw new BadRequestException('Missing identity verification files');
    }

    const dto: SubmitIdentityVerificationRequest = {
      frontDni: fileToDocument(frontDni),
      backDni: fileToDocument(backDni),
      selfie: fileToDocument(selfie),
    };

    return this.identityService.submitMyVerification(userId, dto);
  }
}