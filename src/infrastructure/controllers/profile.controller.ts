import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateMyProfileRequestSchema } from '@rocket-lease/contracts';
import type { UpdateMyProfileRequest } from '@rocket-lease/contracts';
import { AuthService } from '@/application/auth.service';
import { ProfileService } from '@/application/profile.service';

@Controller('profile')
export class ProfileController {
  constructor(
    private readonly authService: AuthService,
    private readonly profileService: ProfileService,
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

  @Get('me')
  @HttpCode(200)
  public async getMyProfile(@Headers('authorization') authorization?: string) {
    const userId = await this.resolveUserId(authorization);
    return this.profileService.getMyProfile(userId);
  }

  @Get(':id')
  @HttpCode(200)
  public async getProfileById(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    await this.resolveUserId(authorization);
    return this.profileService.getProfileById(id);
  }

  @Patch('me')
  @HttpCode(200)
  public async updateMyProfile(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: UpdateMyProfileRequest,
  ) {
    const userId = await this.resolveUserId(authorization);
    const dto = UpdateMyProfileRequestSchema.parse(body);
    return this.profileService.updateMyProfile(userId, dto);
  }

  @Post('me/avatar')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  public async uploadAvatar(
    @Headers('authorization') authorization: string | undefined,
    @UploadedFile()
    file?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    const userId = await this.resolveUserId(authorization);
    if (!file) {
      throw new BadRequestException('Missing file');
    }
    return this.profileService.updateAvatar(userId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
  }

  @Delete('me')
  @HttpCode(204)
  public async deleteMyAccount(
    @Headers('authorization') authorization: string | undefined,
  ) {
    const userId = await this.resolveUserId(authorization);
    await this.authService.deleteAccount(userId);
  }
}
