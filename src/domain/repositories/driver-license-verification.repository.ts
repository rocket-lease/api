import { DriverLicenseVerification } from '@/domain/entities/driver-license-verification.entity';

export interface DriverLicenseVerificationRepository {
  save(driverLicenseVerification: DriverLicenseVerification): Promise<DriverLicenseVerification>;
  findByUserId(userId: string): Promise<DriverLicenseVerification | null>;
  findByUserIds(userIds: string[]): Promise<DriverLicenseVerification[]>;
  findByProviderRequestId(
    providerRequestId: string,
  ): Promise<DriverLicenseVerification | null>;
  findDueForReview(now: Date): Promise<DriverLicenseVerification[]>;
}

export const DRIVER_LICENSE_VERIFICATION_REPOSITORY = Symbol(
  'DriverLicenseVerificationRepository',
);