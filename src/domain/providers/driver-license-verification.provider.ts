import type { DriverLicenseVerificationDocuments } from '@rocket-lease/contracts';

export interface DriverLicenseVerificationProviderSubmission {
  providerName: string;
  providerRequestId: string;
  reviewAfterAt: Date;
}

export interface DriverLicenseVerificationProviderCheckResult {
  providerName: string;
  providerRequestId: string;
  status: 'verified' | 'pending' | 'rejected';
  reviewAfterAt?: Date;
  rejectionReason?: string | null;
}

export interface DriverLicenseVerificationProvider {
  submitVerification(input: {
    userId: string;
    submittedAt: Date;
    documents: DriverLicenseVerificationDocuments;
  }): Promise<DriverLicenseVerificationProviderSubmission>;

  checkVerification(input: {
    providerRequestId: string;
    checkedAt: Date;
  }): Promise<DriverLicenseVerificationProviderCheckResult>;
}

export const DRIVER_LICENSE_VERIFICATION_PROVIDER = Symbol('DriverLicenseVerificationProvider');