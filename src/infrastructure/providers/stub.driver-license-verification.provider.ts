import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import {
  type DriverLicenseVerificationProvider,
  type DriverLicenseVerificationProviderCheckResult,
} from '@/domain/providers/driver-license-verification.provider';

type StubVerificationRecord = {
  reviewAfterAt: Date;
};

@Injectable()
export class StubDriverLicenseVerificationProvider implements DriverLicenseVerificationProvider {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  private readonly verifications = new Map<string, StubVerificationRecord>();

  async submitVerification(_input: {
    userId: string;
    submittedAt: Date;
    documents: unknown;
  }): Promise<{
    providerName: string;
    providerRequestId: string;
    reviewAfterAt: Date;
  }> {
    const now = this.clock.now();
    const providerRequestId = `stub-driver-license-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    const reviewAfterAt = new Date(now.getTime() + 30_000);

    this.verifications.set(providerRequestId, { reviewAfterAt });

    return {
      providerName: 'stub-driver-license-provider',
      providerRequestId,
      reviewAfterAt,
    };
  }

  async checkVerification(input: {
    providerRequestId: string;
    checkedAt: Date;
  }): Promise<DriverLicenseVerificationProviderCheckResult> {
    const record = this.verifications.get(input.providerRequestId);
    if (!record) {
      return {
        providerName: 'stub-driver-license-provider',
        providerRequestId: input.providerRequestId,
        status: 'rejected',
        rejectionReason: 'Verification request not found',
      };
    }

    if (input.checkedAt.getTime() < record.reviewAfterAt.getTime()) {
      return {
        providerName: 'stub-driver-license-provider',
        providerRequestId: input.providerRequestId,
        status: 'pending',
        reviewAfterAt: record.reviewAfterAt,
      };
    }

    return {
      providerName: 'stub-driver-license-provider',
      providerRequestId: input.providerRequestId,
      status: 'verified',
    };
  }
}