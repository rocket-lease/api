import { IdentityService } from '@/application/identity.service';
import { IdentityVerification } from '@/domain/entities/identity-verification.entity';
import { IdentityVerificationRequiredException } from '@/domain/exceptions/domain.exception';
import type { IdentityVerificationProvider } from '@/domain/providers/identity-verification.provider';
import type { Clock } from '@/domain/providers/clock.provider';
import type { IdentityVerificationRepository } from '@/domain/repositories/identity-verification.repository';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { randomUUID } from 'node:crypto';

describe('IdentityService', () => {
  let service: IdentityService;
  let userRepo: jest.Mocked<UserRepository>;
  let repository: jest.Mocked<IdentityVerificationRepository>;
  let provider: jest.Mocked<IdentityVerificationProvider>;
  let clock: jest.Mocked<Clock>;
  let userId: string;

  beforeEach(() => {
    userRepo = {
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
    };
    repository = {
      save: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue(null),
      findByUserIds: jest.fn().mockResolvedValue([]),
      findByProviderRequestId: jest.fn().mockResolvedValue(null),
      findDueForReview: jest.fn().mockResolvedValue([]),
    };
    provider = {
      submitVerification: jest.fn().mockResolvedValue({
        providerName: 'stub-identity-provider',
        providerRequestId: 'req-1',
        reviewAfterAt: new Date('2026-05-25T12:00:30.000Z'),
      }),
      checkVerification: jest.fn().mockResolvedValue({
        providerName: 'stub-identity-provider',
        providerRequestId: 'req-1',
        status: 'verified',
      }),
    };
    clock = {
      now: jest.fn().mockReturnValue(new Date('2026-05-25T12:00:00.000Z')),
    };
    userId = randomUUID();

    service = new IdentityService(userRepo, repository, provider, clock);
  });

  it('creates a pending verification request', async () => {
    repository.save.mockImplementation(async (value) => value);

    const result = await service.submitMyVerification(userId, {
      frontDni: {
        fileName: 'front.jpg',
        mimeType: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,AAAA',
      },
      backDni: {
        fileName: 'back.jpg',
        mimeType: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,BBBB',
      },
      selfie: {
        fileName: 'selfie.jpg',
        mimeType: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,CCCC',
      },
    });

    expect(provider.submitVerification).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('pending');
  });

  it('rejects access when identity is not verified', async () => {
    repository.findByUserId.mockResolvedValue(null);

    await expect(service.assertVerified(userId)).rejects.toBeInstanceOf(
      IdentityVerificationRequiredException,
    );
  });

  it('marks due pending verifications based on the provider result', async () => {
    const pending = IdentityVerification.pending({
      userId,
      providerName: 'stub-identity-provider',
      providerRequestId: 'req-1',
      reviewAfterAt: new Date('2026-05-25T12:00:01.000Z'),
      submittedAt: new Date('2026-05-25T12:00:00.000Z'),
      documents: {
        frontDni: {
          fileName: 'front.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,AAAA',
        },
        backDni: {
          fileName: 'back.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,BBBB',
        },
        selfie: {
          fileName: 'selfie.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,CCCC',
        },
      },
    });

    repository.findDueForReview.mockResolvedValue([pending]);
    repository.save.mockImplementation(async (value) => value);

    const processed = await service.processDueVerifications(
      new Date('2026-05-25T12:00:30.000Z'),
    );

    expect(processed).toBe(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(provider.checkVerification).toHaveBeenCalledWith({
      providerRequestId: 'req-1',
      checkedAt: new Date('2026-05-25T12:00:30.000Z'),
    });
  });

  it('reschedules a pending verification when the provider still needs time', async () => {
    const pending = IdentityVerification.pending({
      userId,
      providerName: 'stub-identity-provider',
      providerRequestId: 'req-1',
      reviewAfterAt: new Date('2026-05-25T12:00:01.000Z'),
      submittedAt: new Date('2026-05-25T12:00:00.000Z'),
      documents: {
        frontDni: {
          fileName: 'front.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,AAAA',
        },
        backDni: {
          fileName: 'back.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,BBBB',
        },
        selfie: {
          fileName: 'selfie.jpg',
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,CCCC',
        },
      },
    });

    repository.findDueForReview.mockResolvedValue([pending]);
    repository.save.mockImplementation(async (value) => value);
    provider.checkVerification.mockResolvedValueOnce({
      providerName: 'stub-identity-provider',
      providerRequestId: 'req-1',
      status: 'pending',
      reviewAfterAt: new Date('2026-05-25T12:01:00.000Z'),
    });

    const processed = await service.processDueVerifications(
      new Date('2026-05-25T12:00:30.000Z'),
    );

    expect(processed).toBe(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
    const saved = repository.save.mock.calls[0]?.[0];
    expect(saved.getStatus()).toBe('pending');
    expect(saved.getReviewAfterAt()?.toISOString()).toBe('2026-05-25T12:01:00.000Z');
  });
});