export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
}

export interface NotificationProvider {
  notify(userId: string, title: string, message: string): Promise<void>;
}

export const NOTIFICATION_PROVIDER = Symbol('NotificationProvider');
