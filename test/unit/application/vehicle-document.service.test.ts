import { VehicleDocumentService } from '@/application/vehicle-document.service';
import { VehicleDocumentVerification } from '@/domain/entities/vehicle-document-verification.entity';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import {
  EntityNotFoundException,
  VehicleDocumentsAlreadyPendingException,
} from '@/domain/exceptions/domain.exception';
import type { VehicleDocumentRepository } from '@/domain/repositories/vehicle-document.repository';
import type { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import type { Clock } from '@/domain/providers/clock.provider';
import type { VehicleDocumentVerificationProvider } from '@/domain/providers/vehicle-document-verification.provider';
import type { NotificationProvider } from '@/domain/providers/notification.provider';
import type { SubmitVehicleDocumentsRequest } from '@rocket-lease/contracts';
import { randomUUID } from 'crypto';

class FakeClock implements Clock {
  now(): Date {
    return new Date('2026-06-01T10:00:00Z');
  }
}

function makeVehicle(ownerId: string): Vehicle {
  return new Vehicle(
    randomUUID(),
    ownerId,
    'ABC-123',
    'Toyota',
    'Corolla',
    2022,
    5,
    400,
    'Automatico',
    false,
    true,
    ['https://example.com/photo1.jpg'],
    ['GPS'],
    'blue',
    50000,
    50000,
    [],
    'A reliable vehicle',
    'Buenos Aires',
    'CABA',
    '2026-06-01',
  );
}

function makeValidDto(): SubmitVehicleDocumentsRequest {
  return {
    title: {
      filename: 'title.pdf',
      mimeType: 'application/pdf',
      data: 'base64-encoded-pdf-data',
    },
    greenCard: {
      filename: 'green-card.pdf',
      mimeType: 'application/pdf',
      data: 'base64-encoded-pdf-data',
    },
  };
}

describe('VehicleDocumentService', () => {
  let service: VehicleDocumentService;
  let vehicleRepoMock: jest.Mocked<VehicleRepository>;
  let vehicleDocumentRepoMock: jest.Mocked<VehicleDocumentRepository>;
  let verificationProviderMock: jest.Mocked<VehicleDocumentVerificationProvider>;
  let notificationProviderMock: jest.Mocked<NotificationProvider>;
  let clock: FakeClock;

  beforeEach(() => {
    vehicleRepoMock = {
      save: jest.fn(),
      fetchAll: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findByPlate: jest.fn(),
      findByOwnerId: jest.fn(),
      findByCharacteristics: jest.fn(),
      delete: jest.fn(),
      bulkUpdatePrices: jest.fn(),
      countActiveReservationsByVehicleIds: jest.fn(),
      findEnabledVehicles: jest.fn(),
    };

    vehicleDocumentRepoMock = {
      save: jest.fn(),
      findByVehicleId: jest.fn(),
      findPending: jest.fn(),
    };

    verificationProviderMock = {
      submitDocuments: jest.fn(),
      checkVerification: jest.fn(),
    };

    notificationProviderMock = {
      notify: jest.fn(),
    };

    clock = new FakeClock();

    service = new VehicleDocumentService(
      vehicleRepoMock,
      vehicleDocumentRepoMock,
      verificationProviderMock,
      notificationProviderMock,
      clock,
    );
  });

  describe('submitDocuments', () => {
    it('crea verificación pending y deshabilita el vehículo', async () => {
      const rentadorId = randomUUID();
      const vehicleId = randomUUID();
      const vehicle = makeVehicle(rentadorId);
      const dto = makeValidDto();

      vehicleRepoMock.findById.mockResolvedValue(vehicle);
      vehicleDocumentRepoMock.findByVehicleId.mockResolvedValue(null);
      verificationProviderMock.submitDocuments.mockResolvedValue({
        providerName: 'test-provider',
        requestId: vehicleId,
      });

      const mockSavedVerification = VehicleDocumentVerification.pending({
        vehicleId,
        rentadorId,
        documents: dto,
        submittedAt: clock.now(),
      });
      vehicleDocumentRepoMock.save.mockResolvedValue(mockSavedVerification);
      vehicleRepoMock.save.mockResolvedValue(vehicle);

      await service.submitDocuments(rentadorId, vehicleId, dto);

      expect(vehicleRepoMock.findById).toHaveBeenCalledWith(vehicleId);
      expect(verificationProviderMock.submitDocuments).toHaveBeenCalled();
      expect(vehicleDocumentRepoMock.save).toHaveBeenCalled();
      expect(vehicleRepoMock.save).toHaveBeenCalled();
      const savedVehicle = (vehicleRepoMock.save.mock.calls[0][0]);
      expect(savedVehicle.isEnabled()).toBe(false);
    });

    it('lanza EntityNotFoundException si el vehículo no existe', async () => {
      const rentadorId = randomUUID();
      const vehicleId = randomUUID();
      const dto = makeValidDto();

      vehicleRepoMock.findById.mockResolvedValue(null);

      await expect(
        service.submitDocuments(rentadorId, vehicleId, dto),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('lanza EntityNotFoundException si el rentador no es el owner', async () => {
      const rentadorId = randomUUID();
      const vehicleId = randomUUID();
      const differentOwnerId = randomUUID();
      const vehicle = makeVehicle(differentOwnerId);
      const dto = makeValidDto();

      vehicleRepoMock.findById.mockResolvedValue(vehicle);

      await expect(
        service.submitDocuments(rentadorId, vehicleId, dto),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('lanza VehicleDocumentsAlreadyPendingException si ya hay una verificación pending', async () => {
      const rentadorId = randomUUID();
      const vehicleId = randomUUID();
      const vehicle = makeVehicle(rentadorId);
      const dto = makeValidDto();

      const pendingVerification = VehicleDocumentVerification.pending({
        vehicleId,
        rentadorId,
        documents: dto,
        submittedAt: clock.now(),
      });

      vehicleRepoMock.findById.mockResolvedValue(vehicle);
      vehicleDocumentRepoMock.findByVehicleId.mockResolvedValue(
        pendingVerification,
      );

      await expect(
        service.submitDocuments(rentadorId, vehicleId, dto),
      ).rejects.toThrow(VehicleDocumentsAlreadyPendingException);
    });

    it('acepta documentos con datos grandes (simulando archivos pesados)', async () => {
      const rentadorId = randomUUID();
      const vehicleId = randomUUID();
      const vehicle = makeVehicle(rentadorId);
      const largeBase64 = 'A'.repeat(30 * 1024 * 1024);
      const dto: SubmitVehicleDocumentsRequest = {
        title: {
          filename: 'large-title.pdf',
          mimeType: 'application/pdf',
          data: `data:application/pdf;base64,${largeBase64}`,
        },
        greenCard: {
          filename: 'large-green-card.pdf',
          mimeType: 'application/pdf',
          data: `data:application/pdf;base64,${largeBase64}`,
        },
      };

      vehicleRepoMock.findById.mockResolvedValue(vehicle);
      vehicleDocumentRepoMock.findByVehicleId.mockResolvedValue(null);
      verificationProviderMock.submitDocuments.mockResolvedValue({
        providerName: 'test-provider',
        requestId: vehicleId,
      });

      const mockSaved = VehicleDocumentVerification.pending({
        vehicleId,
        rentadorId,
        documents: dto,
        submittedAt: clock.now(),
      });
      vehicleDocumentRepoMock.save.mockResolvedValue(mockSaved);
      vehicleRepoMock.save.mockResolvedValue(vehicle);

      await expect(
        service.submitDocuments(rentadorId, vehicleId, dto),
      ).resolves.not.toThrow();

      expect(verificationProviderMock.submitDocuments).toHaveBeenCalled();
      expect(vehicleDocumentRepoMock.save).toHaveBeenCalled();
    });

    it('retorna la verificación existente si ya está verified', async () => {
      const rentadorId = randomUUID();
      const vehicleId = randomUUID();
      const vehicle = makeVehicle(rentadorId);
      const dto = makeValidDto();

      const verifiedVerification = VehicleDocumentVerification.pending({
        vehicleId,
        rentadorId,
        documents: dto,
        submittedAt: clock.now(),
      });
      verifiedVerification.markVerified(clock.now());

      vehicleRepoMock.findById.mockResolvedValue(vehicle);
      vehicleDocumentRepoMock.findByVehicleId.mockResolvedValue(
        verifiedVerification,
      );

      const result = await service.submitDocuments(
        rentadorId,
        vehicleId,
        dto,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('verified');
      expect(vehicleDocumentRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('getDocumentStatus', () => {
    it('retorna status "none" cuando no hay documentos', async () => {
      const vehicleId = randomUUID();

      vehicleDocumentRepoMock.findByVehicleId.mockResolvedValue(null);

      const result = await service.getDocumentStatus(vehicleId);

      expect(result.status).toBe('none');
      expect(result.submittedAt).toBe(null);
    });

    it('retorna el status actual cuando hay una verificación', async () => {
      const vehicleId = randomUUID();
      const rentadorId = randomUUID();
      const dto = makeValidDto();

      const verification = VehicleDocumentVerification.pending({
        vehicleId,
        rentadorId,
        documents: dto,
        submittedAt: clock.now(),
      });

      vehicleDocumentRepoMock.findByVehicleId.mockResolvedValue(verification);

      const result = await service.getDocumentStatus(vehicleId);

      expect(result.status).toBe('pending');
      expect(result.submittedAt).not.toBe(null);
    });
  });

  describe('processPendingVerifications', () => {
    it('aprueba verificaciones y habilita el vehículo', async () => {
      const rentadorId = randomUUID();
      const vehicleId = randomUUID();
      const vehicle = makeVehicle(rentadorId);
      const dto = makeValidDto();

      const pendingVerification = VehicleDocumentVerification.pending({
        vehicleId,
        rentadorId,
        documents: dto,
        submittedAt: clock.now(),
      });

      vehicleDocumentRepoMock.findPending.mockResolvedValue([
        pendingVerification,
      ]);
      verificationProviderMock.checkVerification.mockResolvedValue({
        status: 'verified',
      });
      vehicleRepoMock.findById.mockResolvedValue(vehicle);
      vehicleDocumentRepoMock.save.mockResolvedValue(pendingVerification);
      vehicleRepoMock.save.mockResolvedValue(vehicle);
      notificationProviderMock.notify.mockResolvedValue(undefined);

      const result = await service.processPendingVerifications();

      expect(result.processed).toBe(1);
      expect(verificationProviderMock.checkVerification).toHaveBeenCalledWith({
        requestId: vehicleId,
      });
      expect(vehicleDocumentRepoMock.save).toHaveBeenCalled();
      expect(vehicleRepoMock.save).toHaveBeenCalled();
      expect(notificationProviderMock.notify).toHaveBeenCalledWith(
        rentadorId,
        'Documentación aprobada',
        'Aprobamos la documentación de tu Toyota Corolla. Ya podés ponerlo a alquilar.',
        { url: '/perfil' },
      );
    });

    it('rechaza verificaciones y notifica', async () => {
      const rentadorId = randomUUID();
      const vehicleId = randomUUID();
      const dto = makeValidDto();

      const pendingVerification = VehicleDocumentVerification.pending({
        vehicleId,
        rentadorId,
        documents: dto,
        submittedAt: clock.now(),
      });

      vehicleDocumentRepoMock.findPending.mockResolvedValue([
        pendingVerification,
      ]);
      verificationProviderMock.checkVerification.mockResolvedValue({
        status: 'rejected',
        rejectionReason: 'Document is blurry',
      });
      vehicleDocumentRepoMock.save.mockResolvedValue(pendingVerification);
      notificationProviderMock.notify.mockResolvedValue(undefined);

      const result = await service.processPendingVerifications();

      expect(result.processed).toBe(1);
      expect(vehicleDocumentRepoMock.save).toHaveBeenCalled();
      expect(notificationProviderMock.notify).toHaveBeenCalledWith(
        rentadorId,
        'Documentación rechazada',
        'Rechazamos la documentación de tu vehículo: Document is blurry. Subí documentos válidos para reintentar.',
        { url: '/perfil' },
      );
    });
  });
});
