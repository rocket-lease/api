import type { IdentityVerificationDocuments } from '@rocket-lease/contracts';

export interface IdentityVerificationProviderSubmission {
  providerName: string;
  providerRequestId: string;
  reviewAfterAt: Date;
}

export interface IdentityVerificationProviderCheckResult {
  providerName: string;
  providerRequestId: string;
  status: 'verified' | 'pending' | 'rejected';
  reviewAfterAt?: Date;
  rejectionReason?: string | null;
}

export interface IdentityVerificationProvider {
  submitVerification(input: {
    userId: string;
    submittedAt: Date;
    documents: IdentityVerificationDocuments;
  }): Promise<IdentityVerificationProviderSubmission>;

  checkVerification(input: {
    providerRequestId: string;
    checkedAt: Date;
  }): Promise<IdentityVerificationProviderCheckResult>;
}

export const IDENTITY_VERIFICATION_PROVIDER = Symbol('IdentityVerificationProvider');