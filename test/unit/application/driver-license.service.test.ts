import { DriverLicenseService } from '@/application/driver-license.service';
import { DriverLicenseVerification } from '@/domain/entities/driver-license-verification.entity';
import {
  InvalidEntityDataException,
  DriverLicenseVerificationRequiredException,
} from '@/domain/exceptions/domain.exception';
import type { DriverLicenseVerificationProvider } from '@/domain/providers/driver-license-verification.provider';
import type { Clock } from '@/domain/providers/clock.provider';
import type { DriverLicenseVerificationRepository } from '@/domain/repositories/driver-license-verification.repository';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { randomUUID } from 'node:crypto';

class FakeClock implements Clock {
  constructor(private d: Date) {}

  now(): Date {
    return this.d;
  }
}

function createPendingVerification(overrides?: {
  userId?: string;
  submittedAt?: Date;
  reviewAfterAt?: Date;
}): DriverLicenseVerification {
  const userId = overrides?.userId ?? randomUUID();
  const submittedAt = overrides?.submittedAt ?? new Date('2026-06-01T10:00:00Z');
  const reviewAfterAt = overrides?.reviewAfterAt ?? new Date('2026-06-08T10:00:00Z');

  return DriverLicenseVerification.pending({
    userId,
    providerName: 'stub-provider',
    providerRequestId: 'req-001',
    reviewAfterAt,
    submittedAt,
    documents: {
      frontLicense: {
        fileName: 'front.jpg',
        mimeType: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,AAAA',
      },
      selfie: {
        fileName: 'selfie.jpg',
        mimeType: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,BBBB',
      },
    },
  });
}

describe('DriverLicenseService', () => {
  let service: DriverLicenseService;
  let userRepoMock: jest.Mocked<UserRepository>;
  let driverLicenseRepoMock: jest.Mocked<DriverLicenseVerificationRepository>;
  let providerMock: jest.Mocked<DriverLicenseVerificationProvider>;
  let clock: FakeClock;
  let userId: string;

  beforeEach(() => {
    userRepoMock = {
      save: jest.fn(),
      updateBasicInfo: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn().mockResolvedValue({}),
      getProfileById: jest.fn(),
      findProfilesByIds: jest.fn().mockResolvedValue([]),
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      creditBalance: jest.fn(),
      deleteById: jest.fn(),
      markPhoneVerified: jest.fn(),
      isPhoneVerified: jest.fn(),
      updateAutoAccept: jest.fn(),
      applyReputationPenalty: jest.fn(),
      updateLevel: jest.fn(),
    };

    driverLicenseRepoMock = {
      save: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue(null),
      findByUserIds: jest.fn().mockResolvedValue([]),
      findByProviderRequestId: jest.fn().mockResolvedValue(null),
      findDueForReview: jest.fn().mockResolvedValue([]),
    };

    providerMock = {
      submitVerification: jest.fn().mockResolvedValue({
        providerName: 'stub-provider',
        providerRequestId: 'req-001',
        reviewAfterAt: new Date('2026-06-08T10:00:00Z'),
      }),
      checkVerification: jest.fn().mockResolvedValue({
        providerName: 'stub-provider',
        providerRequestId: 'req-001',
        status: 'verified',
      }),
    };

    clock = new FakeClock(new Date('2026-06-01T10:00:00Z'));
    userId = randomUUID();

    service = new DriverLicenseService(
      userRepoMock,
      driverLicenseRepoMock,
      providerMock,
      clock,
    );
  });

  describe('getMyVerification', () => {
    it('retorna resumen vacío cuando no hay verificación', async () => {
      driverLicenseRepoMock.findByUserId.mockResolvedValue(null);

      const result = await service.getMyVerification(userId);

      expect(result.status).toBe('not_started');
      expect(result.providerName).toBeNull();
      expect(result.providerRequestId).toBeNull();
      expect(result.rejectionReason).toBeNull();
      expect(result.submittedAt).toBeNull();
    });

    it('retorna el resumen cuando hay una verificación pendiente', async () => {
      const pending = createPendingVerification({ userId });
      driverLicenseRepoMock.findByUserId.mockResolvedValue(pending);

      const result = await service.getMyVerification(userId);

      expect(result.status).toBe('pending');
      expect(result.providerName).toBe('stub-provider');
      expect(result.providerRequestId).toBe('req-001');
      expect(result.submittedAt).toBe('2026-06-01T10:00:00.000Z');
      expect(result.reviewAfterAt).toBe('2026-06-08T10:00:00.000Z');
    });
  });

  describe('submitMyVerification', () => {
    it('acepta archivos grandes (simulando fotos de licencia de alta resolución)', async () => {
      driverLicenseRepoMock.findByUserId.mockResolvedValue(null);
      driverLicenseRepoMock.save.mockImplementation(async (value) => value);
      const largeBase64 = 'X'.repeat(25 * 1024 * 1024);

      const result = await service.submitMyVerification(userId, {
        frontLicense: {
          fileName: 'large-license.heic',
          mimeType: 'image/heic',
          dataUrl: `data:image/heic;base64,${largeBase64}`,
        },
        selfie: {
          fileName: 'large-selfie.heic',
          mimeType: 'image/heic',
          dataUrl: `data:image/heic;base64,${largeBase64}`,
        },
      });

      expect(providerMock.submitVerification).toHaveBeenCalledTimes(1);
      expect(driverLicenseRepoMock.save).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('pending');
    });

    it('crea una verificación pendiente cuando el usuario no tiene ninguna', async () => {
      driverLicenseRepoMock.findByUserId.mockResolvedValue(null);
      driverLicenseRepoMock.save.mockImplementation(async (value) => value);

      const result = await service.submitMyVerification(userId, {
        frontLicense: {
          fileName: 'front.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,AAAA',
        },
        selfie: {
          fileName: 'selfie.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,BBBB',
        },
      });

      expect(providerMock.submitVerification).toHaveBeenCalledTimes(1);
      expect(driverLicenseRepoMock.save).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('pending');
      expect(result.providerName).toBe('stub-provider');
      expect(result.providerRequestId).toBe('req-001');
    });

    it('retorna la verificación existente si ya está verified', async () => {
      const verified = createPendingVerification({ userId });
      verified.markVerified(new Date('2026-06-02T10:00:00Z'));

      driverLicenseRepoMock.findByUserId.mockResolvedValue(verified);

      const result = await service.submitMyVerification(userId, {
        frontLicense: {
          fileName: 'front.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,AAAA',
        },
        selfie: {
          fileName: 'selfie.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,BBBB',
        },
      });

      expect(providerMock.submitVerification).not.toHaveBeenCalled();
      expect(driverLicenseRepoMock.save).not.toHaveBeenCalled();
      expect(result.status).toBe('verified');
    });

    it('retorna la verificación existente si ya está pending', async () => {
      const pending = createPendingVerification({ userId });
      driverLicenseRepoMock.findByUserId.mockResolvedValue(pending);

      const result = await service.submitMyVerification(userId, {
        frontLicense: {
          fileName: 'front.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,AAAA',
        },
        selfie: {
          fileName: 'selfie.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,BBBB',
        },
      });

      expect(providerMock.submitVerification).not.toHaveBeenCalled();
      expect(driverLicenseRepoMock.save).not.toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('lanza InvalidEntityDataException si el usuario no existe', async () => {
      userRepoMock.findById.mockResolvedValue(null);

      await expect(
        service.submitMyVerification(userId, {
          frontLicense: {
            fileName: 'front.jpg',
            mimeType: 'image/jpeg',
            dataUrl: 'data:image/jpeg;base64,AAAA',
          },
          selfie: {
            fileName: 'selfie.jpg',
            mimeType: 'image/jpeg',
            dataUrl: 'data:image/jpeg;base64,BBBB',
          },
        }),
      ).rejects.toBeInstanceOf(InvalidEntityDataException);

      expect(providerMock.submitVerification).not.toHaveBeenCalled();
    });
  });

  describe('assertVerified', () => {
    it('no lanza cuando la verificación está verified', async () => {
      const verified = createPendingVerification({ userId });
      verified.markVerified(new Date('2026-06-02T10:00:00Z'));

      driverLicenseRepoMock.findByUserId.mockResolvedValue(verified);

      await expect(service.assertVerified(userId)).resolves.toBeUndefined();
    });

    it('lanza DriverLicenseVerificationRequiredException cuando no está verified', async () => {
      driverLicenseRepoMock.findByUserId.mockResolvedValue(null);

      await expect(service.assertVerified(userId)).rejects.toBeInstanceOf(
        DriverLicenseVerificationRequiredException,
      );
    });

    it('lanza DriverLicenseVerificationRequiredException cuando está pending', async () => {
      const pending = createPendingVerification({ userId });
      driverLicenseRepoMock.findByUserId.mockResolvedValue(pending);

      await expect(service.assertVerified(userId)).rejects.toBeInstanceOf(
        DriverLicenseVerificationRequiredException,
      );
    });
  });

  describe('processDueVerifications', () => {
    it('procesa verificaciones pendientes cuando el proveedor retorna verified', async () => {
      const pending = createPendingVerification({ userId });
      driverLicenseRepoMock.findDueForReview.mockResolvedValue([pending]);
      driverLicenseRepoMock.save.mockImplementation(async (value) => value);

      const checkedAt = new Date('2026-06-08T10:00:00Z');
      const processed = await service.processDueVerifications(checkedAt);

      expect(processed).toBe(1);
      expect(providerMock.checkVerification).toHaveBeenCalledWith({
        providerRequestId: 'req-001',
        checkedAt,
      });
      expect(driverLicenseRepoMock.save).toHaveBeenCalledTimes(1);
      const saved = driverLicenseRepoMock.save.mock.calls[0]?.[0];
      expect(saved?.getStatus()).toBe('verified');
    });

    it('reschedules una verificación cuando el proveedor retorna pending', async () => {
      const pending = createPendingVerification({ userId });
      driverLicenseRepoMock.findDueForReview.mockResolvedValue([pending]);
      driverLicenseRepoMock.save.mockImplementation(async (value) => value);

      providerMock.checkVerification.mockResolvedValueOnce({
        providerName: 'stub-provider',
        providerRequestId: 'req-001',
        status: 'pending',
        reviewAfterAt: new Date('2026-06-15T10:00:00Z'),
      });

      const checkedAt = new Date('2026-06-08T10:00:00Z');
      const processed = await service.processDueVerifications(checkedAt);

      expect(processed).toBe(1);
      expect(driverLicenseRepoMock.save).toHaveBeenCalledTimes(1);
      const saved = driverLicenseRepoMock.save.mock.calls[0]?.[0];
      expect(saved?.getStatus()).toBe('pending');
      expect(saved?.getReviewAfterAt()?.toISOString()).toBe('2026-06-15T10:00:00.000Z');
    });

    it('marca como rechazada cuando el proveedor retorna rejected', async () => {
      const pending = createPendingVerification({ userId });
      driverLicenseRepoMock.findDueForReview.mockResolvedValue([pending]);
      driverLicenseRepoMock.save.mockImplementation(async (value) => value);

      providerMock.checkVerification.mockResolvedValueOnce({
        providerName: 'stub-provider',
        providerRequestId: 'req-001',
        status: 'rejected',
        rejectionReason: 'documento ilegible',
      });

      const checkedAt = new Date('2026-06-08T10:00:00Z');
      const processed = await service.processDueVerifications(checkedAt);

      expect(processed).toBe(1);
      expect(driverLicenseRepoMock.save).toHaveBeenCalledTimes(1);
      const saved = driverLicenseRepoMock.save.mock.calls[0]?.[0];
      expect(saved?.getStatus()).toBe('rejected');
      expect(saved?.getRejectionReason()).toBe('documento ilegible');
    });

    it('retorna el número de verificaciones procesadas', async () => {
      const pending1 = createPendingVerification({
        userId: randomUUID(),
        submittedAt: new Date('2026-06-01T10:00:00Z'),
        reviewAfterAt: new Date('2026-06-02T10:00:00Z'),
      });
      const pending2 = createPendingVerification({
        userId: randomUUID(),
        submittedAt: new Date('2026-06-01T11:00:00Z'),
        reviewAfterAt: new Date('2026-06-02T11:00:00Z'),
      });

      driverLicenseRepoMock.findDueForReview.mockResolvedValue([pending1, pending2]);
      driverLicenseRepoMock.save.mockImplementation(async (value) => value);

      const processed = await service.processDueVerifications();

      expect(processed).toBe(2);
      expect(driverLicenseRepoMock.save).toHaveBeenCalledTimes(2);
    });

    it('usa la fecha actual del reloj cuando no se proporciona una', async () => {
      const pending = createPendingVerification({ userId });
      driverLicenseRepoMock.findDueForReview.mockResolvedValue([pending]);
      driverLicenseRepoMock.save.mockImplementation(async (value) => value);

      await service.processDueVerifications();

      expect(driverLicenseRepoMock.findDueForReview).toHaveBeenCalledWith(
        new Date('2026-06-01T10:00:00Z'),
      );
    });
  });
});
