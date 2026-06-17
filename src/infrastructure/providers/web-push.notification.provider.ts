import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import webpush from 'web-push';
import type { NotificationProvider, NotifyOptions } from '@/domain/providers/notification.provider';
import type { PushSubscriptionRepository } from '@/domain/repositories/push-subscription.repository';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '@/domain/repositories/push-subscription.repository';

@Injectable()
export class WebPushNotificationProvider implements NotificationProvider, OnModuleInit {
  private readonly logger = new Logger(WebPushNotificationProvider.name);

  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: PushSubscriptionRepository,
  ) {}

  onModuleInit() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
      this.logger.warn('VAPID keys not configured — push notifications disabled');
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  async notify(userId: string, title: string, message: string, options?: NotifyOptions): Promise<void> {
    if (!process.env.VAPID_PUBLIC_KEY) return;

    const subs = await this.subscriptions.findByUserId(userId);
    if (subs.length === 0) return;

    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: options?.tag,
      requireInteraction: options?.requireInteraction ?? false,
      data: { url: options?.url ?? '/' },
    });

    await Promise.allSettled(
      subs.map(async sub => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
            payload,
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            await this.subscriptions.deleteByEndpoint(sub.endpoint);
            this.logger.log(`Removed expired push subscription for user ${userId}`);
          } else {
            this.logger.warn(`Push failed for user ${userId}: ${String(err)}`);
          }
        }
      }),
    );
  }
}
