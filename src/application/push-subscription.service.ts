import { Inject, Injectable } from '@nestjs/common';
import type { RegisterPushSubscriptionRequest } from '@rocket-lease/contracts';
import type { PushSubscriptionRepository } from '@/domain/repositories/push-subscription.repository';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '@/domain/repositories/push-subscription.repository';

@Injectable()
export class PushSubscriptionService {
  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly repo: PushSubscriptionRepository,
  ) {}

  async register(userId: string, dto: RegisterPushSubscriptionRequest): Promise<void> {
    await this.repo.save({
      userId,
      endpoint: dto.endpoint,
      auth: dto.keys.auth,
      p256dh: dto.keys.p256dh,
    });
  }

  async unregister(endpoint: string): Promise<void> {
    await this.repo.deleteByEndpoint(endpoint);
  }

  getVapidPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY ?? '';
  }
}
