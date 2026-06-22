import { Inject, Injectable } from '@nestjs/common';
import {
  GetMyProfileResponse,
  GetMyProfileResponseSchema,
  GetPublicProfileResponse,
  GetPublicProfileResponseSchema,
  UpdateMyProfileRequest,
  UpdateMyProfileResponse,
  UpdateMyProfileResponseSchema,
} from '@rocket-lease/contracts';
import { IdentityService } from '@/application/identity.service';
import { DriverLicenseService } from '@/application/driver-license.service';
import { ReputationService } from '@/application/reputation.service';
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
    @Inject(IdentityService) private readonly identityService: IdentityService,
    @Inject(DriverLicenseService) private readonly driverLicenseService: DriverLicenseService,
    @Inject(ReputationService) private readonly reputationService: ReputationService,
  ) {}

  public async getMyProfile(userId: string): Promise<GetMyProfileResponse> {
    const [profile, identityVerification, driverLicenseVerification] = await Promise.all([
      this.userRepository.getProfileById(userId),
      this.identityService.getSummaryByUserId(userId),
      this.driverLicenseService.getSummaryByUserId(userId),
    ]);
    if (!profile) {
      throw new InvalidEntityDataException('User not found');
    }

    return GetMyProfileResponseSchema.parse({
      ...profile,
      verificationStatus: identityVerification.status,
      identityVerification,
      driverLicenseVerification,
    });
  }

  public async getProfileById(userId: string): Promise<GetPublicProfileResponse> {
    const profile = await this.userRepository.getProfileById(userId);
    if (!profile) {
      throw new InvalidEntityDataException('User not found');
    }

    const identityVerification = await this.identityService.getSummaryByUserId(userId);
    const driverLicenseVerification = await this.driverLicenseService.getSummaryByUserId(userId);
    return GetPublicProfileResponseSchema.parse({
      ...profile,
      verificationStatus: identityVerification.status,
      identityVerification,
      driverLicenseVerification,
    });
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

    const identityVerification = await this.identityService.getSummaryByUserId(userId);
    const driverLicenseVerification = await this.driverLicenseService.getSummaryByUserId(userId);
    return UpdateMyProfileResponseSchema.parse({
      ...updated,
      verificationStatus: identityVerification.status,
      identityVerification,
      driverLicenseVerification,
    });
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

    const identityVerification = await this.identityService.getSummaryByUserId(userId);
    const driverLicenseVerification = await this.driverLicenseService.getSummaryByUserId(userId);
    return GetMyProfileResponseSchema.parse({
      ...updated,
      verificationStatus: identityVerification.status,
      identityVerification,
      driverLicenseVerification,
    });
  }
}
