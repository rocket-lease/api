import { Injectable } from '@nestjs/common';
import {
  IdentityVerificationProvider,
  type IdentityVerificationProviderCheckResult,
} from '@/domain/providers/identity-verification.provider';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { Inject } from '@nestjs/common';

type StubVerificationRecord = {
  reviewAfterAt: Date;
};

@Injectable()
export class StubIdentityVerificationProvider implements IdentityVerificationProvider {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  private readonly verifications = new Map<string, StubVerificationRecord>();

  async submitVerification(input: {
    userId: string;
    submittedAt: Date;
    documents: unknown;
  }): Promise<{
    providerName: string;
    providerRequestId: string;
    reviewAfterAt: Date;
  }> {
    const now = this.clock.now();
    const providerRequestId = `stub-identity-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    const reviewAfterAt = new Date(now.getTime() + 30_000);

    this.verifications.set(providerRequestId, { reviewAfterAt });

    return {
      providerName: 'stub-identity-provider',
      providerRequestId,
      reviewAfterAt,
    };
  }

  async checkVerification(input: {
    providerRequestId: string;
    checkedAt: Date;
  }): Promise<IdentityVerificationProviderCheckResult> {
    const record = this.verifications.get(input.providerRequestId);
    if (!record) {
      return {
        providerName: 'stub-identity-provider',
        providerRequestId: input.providerRequestId,
        status: 'rejected',
        rejectionReason: 'Verification request not found',
      };
    }

    if (input.checkedAt.getTime() < record.reviewAfterAt.getTime()) {
      return {
        providerName: 'stub-identity-provider',
        providerRequestId: input.providerRequestId,
        status: 'pending',
        reviewAfterAt: record.reviewAfterAt,
      };
    }

    return {
      providerName: 'stub-identity-provider',
      providerRequestId: input.providerRequestId,
      status: 'verified',
    };
  }
}