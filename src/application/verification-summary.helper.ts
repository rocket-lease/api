import { type VerificationSummary } from '@rocket-lease/contracts';

export function createEmptyVerificationSummary(): VerificationSummary {
  return {
    status: 'not_started',
    providerName: null,
    providerRequestId: null,
    rejectionReason: null,
    submittedAt: null,
    reviewAfterAt: null,
    reviewedAt: null,
    verifiedAt: null,
  };
}