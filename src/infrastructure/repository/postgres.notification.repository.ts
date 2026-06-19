import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type {
  NewNotification,
  NotificationData,
  NotificationRepository,
} from '@/domain/repositories/notification.repository';

@Injectable()
export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(data: NewNotification): Promise<NotificationData> {
    const row = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        body: data.body,
        url: data.url,
        imageUrl: data.imageUrl,
      },
    });
    return this.toData(row);
  }

  async findByUserId(userId: string, limit: number): Promise<NotificationData[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(row => this.toData(row));
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private toData(row: {
    id: string;
    userId: string;
    title: string;
    body: string;
    url: string | null;
    imageUrl: string | null;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationData {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      body: row.body,
      url: row.url,
      imageUrl: row.imageUrl,
      readAt: row.readAt,
      createdAt: row.createdAt,
    };
  }
}
