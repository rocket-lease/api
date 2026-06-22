import { VehicleDocumentVerification } from '../entities/vehicle-document-verification.entity';

export interface VehicleDocumentRepository {
  save(
    verification: VehicleDocumentVerification,
  ): Promise<VehicleDocumentVerification>;
  findByVehicleId(
    vehicleId: string,
  ): Promise<VehicleDocumentVerification | null>;
  findByVehicleIds(
    vehicleIds: string[],
  ): Promise<VehicleDocumentVerification[]>;
  findPending(): Promise<VehicleDocumentVerification[]>;
}

export const VEHICLE_DOCUMENT_REPOSITORY = Symbol(
  'VehicleDocumentRepository',
);
