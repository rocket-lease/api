export interface NotificationProvider {
  notify(userId: string, title: string, message: string, options?: { url?: string }): Promise<void>;
}

export const NOTIFICATION_PROVIDER = Symbol('NotificationProvider');
