import { Inject, Injectable } from '@nestjs/common';
import {
  SubmitVehicleDocumentsRequest,
  SubmitVehicleDocumentsRequestSchema,
  type SubmitVehicleDocumentsResponse,
  SubmitVehicleDocumentsResponseSchema,
  type GetVehicleDocumentStatusResponse,
  GetVehicleDocumentStatusResponseSchema,
  type ProcessDocumentsResponse,
  ProcessDocumentsResponseSchema,
} from '@rocket-lease/contracts';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import {
  VehicleDocumentsAlreadyPendingException,
  EntityNotFoundException,
} from '@/domain/exceptions/domain.exception';
import type { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import {
  VEHICLE_DOCUMENT_REPOSITORY,
  type VehicleDocumentRepository,
} from '@/domain/repositories/vehicle-document.repository';
import {
  VEHICLE_DOCUMENT_VERIFICATION_PROVIDER,
  type VehicleDocumentVerificationProvider,
} from '@/domain/providers/vehicle-document-verification.provider';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '@/domain/providers/notification.provider';
import { VehicleDocumentVerification } from '@/domain/entities/vehicle-document-verification.entity';

@Injectable()
export class VehicleDocumentService {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_DOCUMENT_REPOSITORY)
    private readonly vehicleDocumentRepository: VehicleDocumentRepository,
    @Inject(VEHICLE_DOCUMENT_VERIFICATION_PROVIDER)
    private readonly verificationProvider: VehicleDocumentVerificationProvider,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  public async submitDocuments(
    rentadorId: string,
    vehicleId: string,
    dto: SubmitVehicleDocumentsRequest,
  ): Promise<SubmitVehicleDocumentsResponse> {
    const parsed = SubmitVehicleDocumentsRequestSchema.parse(dto);

    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle) {
      throw new EntityNotFoundException('vehicle', vehicleId);
    }
    if (!vehicle.isOwnedBy(rentadorId)) {
      throw new EntityNotFoundException('vehicle', vehicleId);
    }

    const existing = await this.vehicleDocumentRepository.findByVehicleId(vehicleId);
    if (existing) {
      if (existing.getStatus() === 'verified') {
        return SubmitVehicleDocumentsResponseSchema.parse(existing.toSummary());
      }
      if (existing.getStatus() === 'pending') {
        throw new VehicleDocumentsAlreadyPendingException(vehicleId);
      }
    }

    const submittedAt = this.clock.now();
    await this.verificationProvider.submitDocuments({
      vehicleId,
      rentadorId,
      documents: parsed,
    });

    const verification = VehicleDocumentVerification.pending({
      vehicleId,
      rentadorId,
      documents: parsed,
      submittedAt,
    });

    const saved = await this.vehicleDocumentRepository.save(verification);

    vehicle.update({ enabled: false });
    await this.vehicleRepository.save(vehicle);

    return SubmitVehicleDocumentsResponseSchema.parse(saved.toSummary());
  }

  public async getDocumentStatus(
    vehicleId: string,
  ): Promise<GetVehicleDocumentStatusResponse> {
    const verification =
      await this.vehicleDocumentRepository.findByVehicleId(vehicleId);
    if (!verification) {
      return GetVehicleDocumentStatusResponseSchema.parse({
        status: 'none',
        documents: {
          title: { filename: '' },
          greenCard: { filename: '' },
        },
        rejectionReason: null,
        submittedAt: null,
        reviewedAt: null,
        verifiedAt: null,
      });
    }

    return GetVehicleDocumentStatusResponseSchema.parse(verification.toSummary());
  }

  public async processPendingVerifications(
    now?: Date,
  ): Promise<ProcessDocumentsResponse> {
    const checkedAt = now ?? this.clock.now();
    const pending = await this.vehicleDocumentRepository.findPending();
    let processed = 0;

    for (const verification of pending) {
      const vehicleId = verification.getVehicleId();

      const providerResult = await this.verificationProvider.checkVerification({
        requestId: vehicleId,
      });

      if (providerResult.status === 'verified') {
        verification.markVerified(checkedAt);
        await this.vehicleDocumentRepository.save(verification);

        const vehicle = await this.vehicleRepository.findById(vehicleId);
        if (vehicle) {
          vehicle.update({ enabled: true });
          await this.vehicleRepository.save(vehicle);
        }

        await this.notificationProvider.notify(
          verification.getRentadorId(),
          'Documentación aprobada',
          'La documentación de tu vehículo ha sido aprobada. Ya puede alquilarse en la plataforma.',
          { url: '/perfil' },
        );

        processed += 1;
      } else if (providerResult.status === 'rejected') {
        verification.markRejected(
          providerResult.rejectionReason ??
            'Verificación de documentos rechazada',
          checkedAt,
        );
        await this.vehicleDocumentRepository.save(verification);

        await this.notificationProvider.notify(
          verification.getRentadorId(),
          'Documentación rechazada',
          `La documentación de tu vehículo ha sido rechazada: ${providerResult.rejectionReason ?? 'Motivo no especificado'}. Por favor, sube documentos válidos.`,
          { url: '/perfil' },
        );

        processed += 1;
      }
    }

    return ProcessDocumentsResponseSchema.parse({ processed });
  }
}
