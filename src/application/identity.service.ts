import { Inject, Injectable } from '@nestjs/common';
import {
  GetMyIdentityVerificationResponse,
  GetMyIdentityVerificationResponseSchema,
  IdentityVerificationSummary,
  IdentityVerificationSummarySchema,
  SubmitIdentityVerificationRequest,
  SubmitIdentityVerificationResponse,
  SubmitIdentityVerificationResponseSchema,
} from '@rocket-lease/contracts';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { InvalidEntityDataException, IdentityVerificationRequiredException } from '@/domain/exceptions/domain.exception';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import {
  IDENTITY_VERIFICATION_PROVIDER,
  type IdentityVerificationProvider,
} from '@/domain/providers/identity-verification.provider';
import {
  IDENTITY_VERIFICATION_REPOSITORY,
  type IdentityVerificationRepository,
} from '@/domain/repositories/identity-verification.repository';
import { IdentityVerification } from '@/domain/entities/identity-verification.entity';

const STUB_PROVIDER_NAME = 'stub-identity-provider';

@Injectable()
export class IdentityService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(IDENTITY_VERIFICATION_REPOSITORY)
    private readonly identityVerificationRepository: IdentityVerificationRepository,
    @Inject(IDENTITY_VERIFICATION_PROVIDER)
    private readonly identityVerificationProvider: IdentityVerificationProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  public async getMyVerification(userId: string): Promise<GetMyIdentityVerificationResponse> {
    const summary = await this.getSummaryByUserId(userId);
    return GetMyIdentityVerificationResponseSchema.parse(summary);
  }

  public async submitMyVerification(
    userId: string,
    dto: SubmitIdentityVerificationRequest,
  ): Promise<SubmitIdentityVerificationResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new InvalidEntityDataException('User not found');
    }

    const current = await this.identityVerificationRepository.findByUserId(userId);
    if (current?.getStatus() === 'verified') {
      return SubmitIdentityVerificationResponseSchema.parse(current.toSummary());
    }
    if (current?.getStatus() === 'pending') {
      return SubmitIdentityVerificationResponseSchema.parse(current.toSummary());
    }

    const submittedAt = this.clock.now();
    const providerResult = await this.identityVerificationProvider.submitVerification({
      userId,
      submittedAt,
      documents: dto,
    });

    const verification = IdentityVerification.pending({
      userId,
      providerName: providerResult.providerName,
      providerRequestId: providerResult.providerRequestId,
      reviewAfterAt: providerResult.reviewAfterAt,
      submittedAt,
      documents: dto,
    });

    const saved = await this.identityVerificationRepository.save(verification);
    return SubmitIdentityVerificationResponseSchema.parse(saved.toSummary());
  }

  public async assertVerified(userId: string): Promise<void> {
    const summary = await this.getSummaryByUserId(userId);
    if (summary.status !== 'verified') {
      throw new IdentityVerificationRequiredException();
    }
  }

  public async getSummaryByUserId(userId: string): Promise<IdentityVerificationSummary> {
    const verification = await this.identityVerificationRepository.findByUserId(userId);
    if (!verification) {
      return IdentityVerificationSummarySchema.parse({
        status: 'not_started',
        providerName: null,
        providerRequestId: null,
        rejectionReason: null,
        submittedAt: null,
        reviewAfterAt: null,
        reviewedAt: null,
        verifiedAt: null,
      });
    }

    return IdentityVerificationSummarySchema.parse(verification.toSummary());
  }

  public async getSummariesByUserIds(
    userIds: string[],
  ): Promise<Map<string, IdentityVerificationSummary>> {
    if (userIds.length === 0) return new Map();

    const verifications = await this.identityVerificationRepository.findByUserIds(userIds);
    const map = new Map<string, IdentityVerificationSummary>();
    for (const verification of verifications) {
      map.set(verification.getUserId(), IdentityVerificationSummarySchema.parse(verification.toSummary()));
    }
    for (const userId of userIds) {
      if (!map.has(userId)) {
        map.set(userId, IdentityVerificationSummarySchema.parse({
          status: 'not_started',
          providerName: null,
          providerRequestId: null,
          rejectionReason: null,
          submittedAt: null,
          reviewAfterAt: null,
          reviewedAt: null,
          verifiedAt: null,
        }));
      }
    }
    return map;
  }

  public async processDueVerifications(now: Date = this.clock.now()): Promise<number> {
    const due = await this.identityVerificationRepository.findDueForReview(now);
    let processed = 0;

    for (const verification of due) {
      const providerRequestId = verification.getProviderRequestId();
      if (!providerRequestId) continue;

      const providerResult = await this.identityVerificationProvider.checkVerification({
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

      await this.identityVerificationRepository.save(verification);
      processed += 1;
    }

    return processed;
  }

  public getProviderName(): string {
    return STUB_PROVIDER_NAME;
  }
}