import { Inject, Injectable } from '@nestjs/common';
import {
  ListNotificationsResponseSchema,
  UnreadCountResponseSchema,
  type InAppNotification,
  type ListNotificationsResponse,
  type UnreadCountResponse,
} from '@rocket-lease/contracts';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationData,
  type NotificationRepository,
} from '@/domain/repositories/notification.repository';

const NOTIFICATION_PAGE_SIZE = 50;

@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repository: NotificationRepository,
  ) {}

  async list(userId: string): Promise<ListNotificationsResponse> {
    const [rows, unreadCount] = await Promise.all([
      this.repository.findByUserId(userId, NOTIFICATION_PAGE_SIZE),
      this.repository.countUnread(userId),
    ]);
    return ListNotificationsResponseSchema.parse({
      notifications: rows.map(toDto),
      unreadCount,
    });
  }

  async unreadCount(userId: string): Promise<UnreadCountResponse> {
    const unreadCount = await this.repository.countUnread(userId);
    return UnreadCountResponseSchema.parse({ unreadCount });
  }

  async markRead(userId: string, notificationId: string): Promise<UnreadCountResponse> {
    await this.repository.markRead(userId, notificationId);
    return this.unreadCount(userId);
  }

  async markAllRead(userId: string): Promise<UnreadCountResponse> {
    await this.repository.markAllRead(userId);
    return UnreadCountResponseSchema.parse({ unreadCount: 0 });
  }

  async delete(userId: string, notificationId: string): Promise<UnreadCountResponse> {
    await this.repository.delete(userId, notificationId);
    return this.unreadCount(userId);
  }
}

function toDto(row: NotificationData): InAppNotification {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    url: row.url,
    imageUrl: row.imageUrl,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
