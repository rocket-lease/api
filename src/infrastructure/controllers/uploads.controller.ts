import {
  BadRequestException,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Post,
  Body,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { UploadSignRequestSchema } from '@rocket-lease/contracts';
import type { UploadSignResponse } from '@rocket-lease/contracts';
import { AuthService } from '@/application/auth.service';
import { UploadsService } from '@/application/uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly authService: AuthService,
    private readonly uploadsService: UploadsService,
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

  @Post('sign')
  @HttpCode(200)
  async sign(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): Promise<UploadSignResponse> {
    await this.resolveUserId(authorization);
    const dto = UploadSignRequestSchema.parse(body);
    return this.uploadsService.signUpload({ folder: dto.folder, resourceType: dto.resourceType });
  }

  @Delete()
  @HttpCode(204)
  async deleteAsset(
    @Headers('authorization') authorization: string | undefined,
    @Query('publicId') publicId?: string,
  ): Promise<void> {
    await this.resolveUserId(authorization);
    if (!publicId) {
      throw new BadRequestException('Missing publicId query parameter');
    }
    await this.uploadsService.deleteAsset(publicId);
  }
}
