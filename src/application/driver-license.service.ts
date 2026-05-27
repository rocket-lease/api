import { Inject, Injectable } from '@nestjs/common';
import {
  GetMyDriverLicenseVerificationResponse,
  GetMyDriverLicenseVerificationResponseSchema,
  SubmitDriverLicenseVerificationRequest,
  SubmitDriverLicenseVerificationResponse,
  SubmitDriverLicenseVerificationResponseSchema,
  type VerificationSummary,
  VerificationSummarySchema,
} from '@rocket-lease/contracts';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { InvalidEntityDataException, DriverLicenseVerificationRequiredException } from '@/domain/exceptions/domain.exception';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import {
  DRIVER_LICENSE_VERIFICATION_PROVIDER,
  type DriverLicenseVerificationProvider,
} from '@/domain/providers/driver-license-verification.provider';
import {
  DRIVER_LICENSE_VERIFICATION_REPOSITORY,
  type DriverLicenseVerificationRepository,
} from '@/domain/repositories/driver-license-verification.repository';
import { DriverLicenseVerification } from '@/domain/entities/driver-license-verification.entity';
import { createEmptyVerificationSummary } from './verification-summary.helper';

const STUB_PROVIDER_NAME = 'stub-driver-license-provider';

@Injectable()
export class DriverLicenseService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(DRIVER_LICENSE_VERIFICATION_REPOSITORY)
    private readonly driverLicenseVerificationRepository: DriverLicenseVerificationRepository,
    @Inject(DRIVER_LICENSE_VERIFICATION_PROVIDER)
    private readonly driverLicenseVerificationProvider: DriverLicenseVerificationProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  public async getMyVerification(userId: string): Promise<GetMyDriverLicenseVerificationResponse> {
    const summary = await this.getSummaryByUserId(userId);
    return GetMyDriverLicenseVerificationResponseSchema.parse(summary);
  }

  public async submitMyVerification(
    userId: string,
    dto: SubmitDriverLicenseVerificationRequest,
  ): Promise<SubmitDriverLicenseVerificationResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new InvalidEntityDataException('User not found');
    }

    const current = await this.driverLicenseVerificationRepository.findByUserId(userId);
    if (current?.getStatus() === 'verified') {
      return SubmitDriverLicenseVerificationResponseSchema.parse(current.toSummary());
    }
    if (current?.getStatus() === 'pending') {
      return SubmitDriverLicenseVerificationResponseSchema.parse(current.toSummary());
    }

    const submittedAt = this.clock.now();
    const providerResult = await this.driverLicenseVerificationProvider.submitVerification({
      userId,
      submittedAt,
      documents: dto,
    });

    const verification = DriverLicenseVerification.pending({
      userId,
      providerName: providerResult.providerName,
      providerRequestId: providerResult.providerRequestId,
      reviewAfterAt: providerResult.reviewAfterAt,
      submittedAt,
      documents: dto,
    });

    const saved = await this.driverLicenseVerificationRepository.save(verification);
    return SubmitDriverLicenseVerificationResponseSchema.parse(saved.toSummary());
  }

  public async assertVerified(userId: string): Promise<void> {
    const summary = await this.getSummaryByUserId(userId);
    if (summary.status !== 'verified') {
      throw new DriverLicenseVerificationRequiredException();
    }
  }

  public async getSummaryByUserId(userId: string): Promise<VerificationSummary> {
    const verification = await this.driverLicenseVerificationRepository.findByUserId(userId);
    if (!verification) {
      return VerificationSummarySchema.parse(createEmptyVerificationSummary());
    }

    return VerificationSummarySchema.parse(verification.toSummary());
  }

  public async getSummariesByUserIds(
    userIds: string[],
  ): Promise<Map<string, VerificationSummary>> {
    if (userIds.length === 0) return new Map();

    const verifications = await this.driverLicenseVerificationRepository.findByUserIds(userIds);
    const map = new Map<string, VerificationSummary>();
    for (const verification of verifications) {
      map.set(verification.getUserId(), VerificationSummarySchema.parse(verification.toSummary()));
    }
    for (const userId of userIds) {
      if (!map.has(userId)) {
        map.set(userId, VerificationSummarySchema.parse(createEmptyVerificationSummary()));
      }
    }
    return map;
  }

  public async processDueVerifications(now: Date = this.clock.now()): Promise<number> {
    const due = await this.driverLicenseVerificationRepository.findDueForReview(now);
    let processed = 0;

    for (const verification of due) {
      const providerRequestId = verification.getProviderRequestId();
      if (!providerRequestId) continue;

      const providerResult = await this.driverLicenseVerificationProvider.checkVerification({
        providerRequestId,
        checkedAt: now,
      });

      if (providerResult.status === 'verified') {
        verification.markVerified(now);
      } else if (providerResult.status === 'rejected') {
        verification.markRejected(
          providerResult.rejectionReason ?? 'Verification rejected by provider',
          now,
        );
      } else {
        verification.markPending(providerResult.reviewAfterAt ?? now, now);
      }

      await this.driverLicenseVerificationRepository.save(verification);
      processed += 1;
    }

    return processed;
  }

  public getProviderName(): string {
    return STUB_PROVIDER_NAME;
  }
}