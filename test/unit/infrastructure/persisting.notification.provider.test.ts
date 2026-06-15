import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { PersistingNotificationProvider } from '@/infrastructure/providers/persisting.notification.provider';
import { WebPushNotificationProvider } from '@/infrastructure/providers/web-push.notification.provider';
import type { NotificationRepository } from '@/domain/repositories/notification.repository';
import { NOTIFICATION_REPOSITORY } from '@/domain/repositories/notification.repository';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '@/domain/repositories/push-subscription.repository';

const userId = randomUUID();

describe('PersistingNotificationProvider', () => {
  let repo: jest.Mocked<NotificationRepository>;
  let webPush: jest.Mocked<Pick<WebPushNotificationProvider, 'notify'>>;
  let provider: PersistingNotificationProvider;

  beforeEach(() => {
    repo = {
      save: jest.fn().mockResolvedValue(undefined),
      findByUserId: jest.fn(),
      countUnread: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };
    webPush = { notify: jest.fn().mockResolvedValue(undefined) };
    provider = new PersistingNotificationProvider(
      repo,
      webPush as unknown as WebPushNotificationProvider,
    );
  });

  it('persists the in-app record and then dispatches the push', async () => {
    await provider.notify(userId, 'Reserva confirmada', 'Tu reserva está lista.', {
      url: '/reservas/abc',
    });

    expect(repo.save).toHaveBeenCalledWith({
      userId,
      title: 'Reserva confirmada',
      body: 'Tu reserva está lista.',
      url: '/reservas/abc',
    });
    expect(webPush.notify).toHaveBeenCalledWith(
      userId,
      'Reserva confirmada',
      'Tu reserva está lista.',
      { url: '/reservas/abc' },
    );
  });

  it('persists with a null url when no deep-link is provided', async () => {
    await provider.notify(userId, 'Aviso', 'Cuerpo');

    expect(repo.save).toHaveBeenCalledWith({
      userId,
      title: 'Aviso',
      body: 'Cuerpo',
      url: null,
    });
  });

  it('swallows a persistence failure but still attempts the push (best-effort)', async () => {
    repo.save.mockRejectedValueOnce(new Error('db down'));

    await expect(provider.notify(userId, 'Aviso', 'Cuerpo')).resolves.toBeUndefined();
    expect(webPush.notify).toHaveBeenCalledTimes(1);
  });

  it('swallows a push failure without throwing', async () => {
    webPush.notify.mockRejectedValueOnce(new Error('push down'));

    await expect(provider.notify(userId, 'Aviso', 'Cuerpo')).resolves.toBeUndefined();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('resolves NOTIFICATION_PROVIDER to the persisting provider via Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: NOTIFICATION_REPOSITORY, useValue: repo },
        { provide: PUSH_SUBSCRIPTION_REPOSITORY, useValue: { findByUserId: async () => [] } },
        WebPushNotificationProvider,
        { provide: NOTIFICATION_PROVIDER, useClass: PersistingNotificationProvider },
      ],
    }).compile();

    expect(moduleRef.get(NOTIFICATION_PROVIDER)).toBeInstanceOf(PersistingNotificationProvider);
    await moduleRef.close();
  });
});
