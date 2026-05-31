import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { PushSubscriptionData, PushSubscriptionRepository } from '@/domain/repositories/push-subscription.repository';

@Injectable()
export class PostgresPushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(data: Omit<PushSubscriptionData, 'id'>): Promise<PushSubscriptionData> {
    const row = await this.prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      update: { auth: data.auth, p256dh: data.p256dh, userId: data.userId },
      create: { userId: data.userId, endpoint: data.endpoint, auth: data.auth, p256dh: data.p256dh },
    });
    return { id: row.id, userId: row.userId, endpoint: row.endpoint, auth: row.auth, p256dh: row.p256dh };
  }

  async findByUserId(userId: string): Promise<PushSubscriptionData[]> {
    const rows = await this.prisma.pushSubscription.findMany({ where: { userId } });
    return rows.map(r => ({ id: r.id, userId: r.userId, endpoint: r.endpoint, auth: r.auth, p256dh: r.p256dh }));
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }
}
