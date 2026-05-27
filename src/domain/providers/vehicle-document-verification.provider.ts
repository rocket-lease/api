export const VEHICLE_DOCUMENT_VERIFICATION_PROVIDER = Symbol(
  'VehicleDocumentVerificationProvider',
);

export interface VehicleDocumentVerificationProvider {
  submitDocuments(input: {
    vehicleId: string;
    rentadorId: string;
    documents: {
      title: { filename: string; mimeType: string; data: string };
      greenCard: { filename: string; mimeType: string; data: string };
    };
  }): Promise<{ providerName: string; requestId: string }>;

  checkVerification(input: {
    requestId: string;
  }): Promise<{
    status: 'pending' | 'verified' | 'rejected';
    rejectionReason?: string;
  }>;
}
