import { IdentityVerification } from '@/domain/entities/identity-verification.entity';

export interface IdentityVerificationRepository {
  save(identityVerification: IdentityVerification): Promise<IdentityVerification>;
  findByUserId(userId: string): Promise<IdentityVerification | null>;
  findByUserIds(userIds: string[]): Promise<IdentityVerification[]>;
  findByProviderRequestId(
    providerRequestId: string,
  ): Promise<IdentityVerification | null>;
  findDueForReview(now: Date): Promise<IdentityVerification[]>;
}

export const IDENTITY_VERIFICATION_REPOSITORY = Symbol(
  'IdentityVerificationRepository',
);