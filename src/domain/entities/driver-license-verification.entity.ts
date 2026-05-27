import { z } from 'zod';
import {
  DriverLicenseVerificationDocumentsSchema,
  IdentityVerificationStatusSchema,
  type DriverLicenseVerificationDocuments,
  type IdentityVerificationStatus,
} from '@rocket-lease/contracts';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const driverLicenseVerificationRecordSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  status: IdentityVerificationStatusSchema,
  providerName: z.string().trim().min(1).nullable(),
  providerRequestId: z.string().trim().min(1).nullable(),
  rejectionReason: z.string().trim().min(1).max(280).nullable(),
  submittedAt: z.date().nullable(),
  reviewAfterAt: z.date().nullable(),
  reviewedAt: z.date().nullable(),
  verifiedAt: z.date().nullable(),
  documents: DriverLicenseVerificationDocumentsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DriverLicenseVerificationProps = z.infer<
  typeof driverLicenseVerificationRecordSchema
>;

export class DriverLicenseVerification {
  private props: DriverLicenseVerificationProps;

  constructor(props: DriverLicenseVerificationProps) {
    const parsed = driverLicenseVerificationRecordSchema.safeParse(props);
    if (!parsed.success) {
      throw new InvalidEntityDataException(parsed.error.issues[0]?.message ?? 'driver license verification is invalid');
    }
    this.props = parsed.data;
  }

  public static pending(input: {
    userId: string;
    providerName: string;
    providerRequestId: string;
    reviewAfterAt: Date;
    submittedAt: Date;
    documents: DriverLicenseVerificationDocuments;
  }): DriverLicenseVerification {
    return new DriverLicenseVerification({
      userId: input.userId,
      status: 'pending',
      providerName: input.providerName,
      providerRequestId: input.providerRequestId,
      rejectionReason: null,
      submittedAt: input.submittedAt,
      reviewAfterAt: input.reviewAfterAt,
      reviewedAt: null,
      verifiedAt: null,
      documents: input.documents,
      createdAt: input.submittedAt,
      updatedAt: input.submittedAt,
    });
  }

  public static fromPersistence(props: DriverLicenseVerificationProps): DriverLicenseVerification {
    return new DriverLicenseVerification(props);
  }

  public getId(): string | undefined {
    return this.props.id;
  }

  public getUserId(): string {
    return this.props.userId;
  }

  public getStatus(): IdentityVerificationStatus {
    return this.props.status;
  }

  public getProviderName(): string | null {
    return this.props.providerName;
  }

  public getProviderRequestId(): string | null {
    return this.props.providerRequestId;
  }

  public getRejectionReason(): string | null {
    return this.props.rejectionReason;
  }

  public getSubmittedAt(): Date | null {
    return this.props.submittedAt;
  }

  public getReviewAfterAt(): Date | null {
    return this.props.reviewAfterAt;
  }

  public getReviewedAt(): Date | null {
    return this.props.reviewedAt;
  }

  public getVerifiedAt(): Date | null {
    return this.props.verifiedAt;
  }

  public getDocuments(): DriverLicenseVerificationDocuments {
    return this.props.documents;
  }

  public markVerified(verifiedAt: Date): void {
    this.props = {
      ...this.props,
      status: 'verified',
      rejectionReason: null,
      reviewedAt: verifiedAt,
      verifiedAt,
      updatedAt: verifiedAt,
    };
  }

  public markPending(reviewAfterAt: Date, reviewedAt: Date): void {
    this.props = {
      ...this.props,
      status: 'pending',
      rejectionReason: null,
      reviewAfterAt,
      reviewedAt,
      verifiedAt: null,
      updatedAt: reviewedAt,
    };
  }

  public markRejected(rejectionReason: string, rejectedAt: Date): void {
    this.props = {
      ...this.props,
      status: 'rejected',
      rejectionReason,
      reviewedAt: rejectedAt,
      updatedAt: rejectedAt,
    };
  }

  public toSummary() {
    return {
      status: this.props.status,
      providerName: this.props.providerName,
      providerRequestId: this.props.providerRequestId,
      rejectionReason: this.props.rejectionReason,
      submittedAt: this.props.submittedAt?.toISOString() ?? null,
      reviewAfterAt: this.props.reviewAfterAt?.toISOString() ?? null,
      reviewedAt: this.props.reviewedAt?.toISOString() ?? null,
      verifiedAt: this.props.verifiedAt?.toISOString() ?? null,
    };
  }

  public toPersistence(): DriverLicenseVerificationProps {
    return this.props;
  }
}