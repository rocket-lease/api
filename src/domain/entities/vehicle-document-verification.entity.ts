import { z } from 'zod';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const documentFileSchema = z.object({
  filename: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  data: z.string().trim().min(1),
});

const vehicleDocumentSchema = z.object({
  id: z.string().uuid().optional(),
  vehicleId: z.string().uuid(),
  rentadorId: z.string().uuid(),
  status: z.enum(['pending', 'verified', 'rejected']),
  documents: z.object({
    title: documentFileSchema,
    greenCard: documentFileSchema,
  }),
  rejectionReason: z.string().nullable(),
  submittedAt: z.date(),
  reviewedAt: z.date().nullable(),
  verifiedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type VehicleDocumentVerificationProps = z.infer<
  typeof vehicleDocumentSchema
>;

export class VehicleDocumentVerification {
  private props: VehicleDocumentVerificationProps;

  constructor(props: VehicleDocumentVerificationProps) {
    const parsed = vehicleDocumentSchema.safeParse(props);
    if (!parsed.success) {
      throw new InvalidEntityDataException(
        parsed.error.issues[0]?.message ?? 'vehicle document verification is invalid',
      );
    }
    this.props = parsed.data;
  }

  public static pending(input: {
    vehicleId: string;
    rentadorId: string;
    documents: { title: { filename: string; mimeType: string; data: string }; greenCard: { filename: string; mimeType: string; data: string } };
    submittedAt: Date;
  }): VehicleDocumentVerification {
    return new VehicleDocumentVerification({
      vehicleId: input.vehicleId,
      rentadorId: input.rentadorId,
      status: 'pending',
      documents: input.documents,
      rejectionReason: null,
      submittedAt: input.submittedAt,
      reviewedAt: null,
      verifiedAt: null,
      createdAt: input.submittedAt,
      updatedAt: input.submittedAt,
    });
  }

  public static fromPersistence(
    props: VehicleDocumentVerificationProps,
  ): VehicleDocumentVerification {
    return new VehicleDocumentVerification(props);
  }

  public getId(): string | undefined {
    return this.props.id;
  }

  public getVehicleId(): string {
    return this.props.vehicleId;
  }

  public getRentadorId(): string {
    return this.props.rentadorId;
  }

  public getStatus(): 'pending' | 'verified' | 'rejected' {
    return this.props.status;
  }

  public getDocuments(): { title: { filename: string; mimeType: string; data: string }; greenCard: { filename: string; mimeType: string; data: string } } {
    return this.props.documents;
  }

  public getRejectionReason(): string | null {
    return this.props.rejectionReason;
  }

  public getSubmittedAt(): Date {
    return this.props.submittedAt;
  }

  public getReviewedAt(): Date | null {
    return this.props.reviewedAt;
  }

  public getVerifiedAt(): Date | null {
    return this.props.verifiedAt;
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
      verifiedAt: null,
      updatedAt: rejectedAt,
    };
  }

  public toSummary() {
    return {
      status: this.props.status,
      documents: {
        title: { filename: this.props.documents.title.filename },
        greenCard: { filename: this.props.documents.greenCard.filename },
      },
      rejectionReason: this.props.rejectionReason,
      submittedAt: this.props.submittedAt.toISOString(),
      reviewedAt: this.props.reviewedAt?.toISOString() ?? null,
      verifiedAt: this.props.verifiedAt?.toISOString() ?? null,
    };
  }

  public toPersistence(): VehicleDocumentVerificationProps {
    return { ...this.props };
  }
}
