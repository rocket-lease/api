import { Inject, Injectable } from '@nestjs/common';
import {
  GetMyProfileResponse,
  GetMyProfileResponseSchema,
  UpdateMyProfileRequest,
  UpdateMyProfileResponse,
  UpdateMyProfileResponseSchema,
} from '@rocket-lease/contracts';
import type { MediaProvider } from '@/domain/providers/media.provider';
import { MEDIA_PROVIDER } from '@/domain/providers/media.provider';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(MEDIA_PROVIDER) private readonly mediaProvider: MediaProvider,
  ) {}

  public async getMyProfile(userId: string): Promise<GetMyProfileResponse> {
    const profile = await this.userRepository.getProfileById(userId);
    if (!profile) {
      throw new InvalidEntityDataException('User not found');
    }

    return GetMyProfileResponseSchema.parse(profile);
  }

  public async getProfileById(userId: string): Promise<GetMyProfileResponse> {
    const profile = await this.userRepository.getProfileById(userId);
    if (!profile) {
      throw new InvalidEntityDataException('User not found');
    }

    return GetMyProfileResponseSchema.parse(profile);
  }

  public async updateMyProfile(
    userId: string,
    dto: UpdateMyProfileRequest,
  ): Promise<UpdateMyProfileResponse> {
    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new InvalidEntityDataException('User not found');
    }

    const updated = await this.userRepository.updateProfile(userId, {
      name: dto.name,
      phone: dto.phone,
      avatarUrl: dto.avatarUrl,
      preferences: dto.preferences,
      autoAccept: dto.autoAccept,
    });

    return UpdateMyProfileResponseSchema.parse(updated);
  }

  public async updateAvatar(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<GetMyProfileResponse> {
    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new InvalidEntityDataException('User not found');
    }

    const avatarUrl = await this.mediaProvider.uploadAvatar(file);
    const updated = await this.userRepository.updateAvatar(userId, avatarUrl);

    return GetMyProfileResponseSchema.parse(updated);
  }
}
