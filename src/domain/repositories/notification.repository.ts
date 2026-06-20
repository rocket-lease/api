export interface NotificationData {
  id: string;
  userId: string;
  title: string;
  body: string;
  url: string | null;
  imageUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NewNotification {
  userId: string;
  title: string;
  body: string;
  url: string | null;
  imageUrl: string | null;
}

export interface NotificationRepository {
  save(data: NewNotification): Promise<NotificationData>;
  findByUserId(userId: string, limit: number): Promise<NotificationData[]>;
  countUnread(userId: string): Promise<number>;
  markRead(userId: string, notificationId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  delete(userId: string, notificationId: string): Promise<void>;
}

export const NOTIFICATION_REPOSITORY = Symbol('NotificationRepository');
