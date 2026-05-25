import type { IdentityVerificationDocuments } from '@rocket-lease/contracts';

export interface IdentityVerificationProviderSubmission {
  providerName: string;
  providerRequestId: string;
  reviewAfterAt: Date;
}

export interface IdentityVerificationProvider {
  submitVerification(input: {
    userId: string;
    submittedAt: Date;
    documents: IdentityVerificationDocuments;
  }): Promise<IdentityVerificationProviderSubmission>;
}

export const IDENTITY_VERIFICATION_PROVIDER = Symbol('IdentityVerificationProvider');