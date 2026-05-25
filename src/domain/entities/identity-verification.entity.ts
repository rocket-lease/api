import { z } from 'zod';
import {
  IdentityVerificationDocumentsSchema,
  IdentityVerificationStatusSchema,
  type IdentityVerificationDocuments,
  type IdentityVerificationStatus,
} from '@rocket-lease/contracts';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const identityVerificationRecordSchema = z.object({
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
  documents: IdentityVerificationDocumentsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type IdentityVerificationProps = z.infer<
  typeof identityVerificationRecordSchema
>;

export class IdentityVerification {
  private props: IdentityVerificationProps;

  constructor(props: IdentityVerificationProps) {
    const parsed = identityVerificationRecordSchema.safeParse(props);
    if (!parsed.success) {
      throw new InvalidEntityDataException(parsed.error.issues[0]?.message ?? 'identity verification is invalid');
    }
    this.props = parsed.data;
  }

  public static pending(input: {
    userId: string;
    providerName: string;
    providerRequestId: string;
    reviewAfterAt: Date;
    submittedAt: Date;
    documents: IdentityVerificationDocuments;
  }): IdentityVerification {
    return new IdentityVerification({
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

  public static fromPersistence(props: IdentityVerificationProps): IdentityVerification {
    return new IdentityVerification(props);
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

  public getDocuments(): IdentityVerificationDocuments {
    return this.props.documents;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.props.updatedAt;
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

  public toPersistence(): IdentityVerificationProps {
    return this.props;
  }
}