import { Injectable, Inject } from '@nestjs/common';
import {
  VehicleDocumentVerificationProvider,
} from '@/domain/providers/vehicle-document-verification.provider';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';

type StubVerificationRecord = {
  reviewAfterAt: Date;
};

@Injectable()
export class StubVehicleDocumentVerificationProvider
  implements VehicleDocumentVerificationProvider
{
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  private readonly verifications = new Map<string, StubVerificationRecord>();

  async submitDocuments(input: {
    vehicleId: string;
    rentadorId: string;
    documents: {
      title: { filename: string; mimeType: string; data: string };
      greenCard: { filename: string; mimeType: string; data: string };
    };
  }): Promise<{ providerName: string; requestId: string }> {
    const now = this.clock.now();
    const reviewAfterAt = new Date(now.getTime() + 30_000);

    this.verifications.set(input.vehicleId, { reviewAfterAt });

    return {
      providerName: 'stub-vehicle-document-provider',
      requestId: input.vehicleId,
    };
  }

  async checkVerification(input: {
    requestId: string;
  }): Promise<{
    status: 'pending' | 'verified' | 'rejected';
    rejectionReason?: string;
  }> {
    const record = this.verifications.get(input.requestId);
    if (!record) {
      return {
        status: 'rejected',
        rejectionReason: 'Verification request not found',
      };
    }

    const now = this.clock.now();
    if (now.getTime() < record.reviewAfterAt.getTime()) {
      return { status: 'pending' };
    }

    return { status: 'verified' };
  }
}
