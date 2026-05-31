import { Injectable, Logger } from '@nestjs/common';
import { NotificationProvider } from '@/domain/providers/notification.provider';

@Injectable()
export class StubNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(StubNotificationProvider.name);

  async notify(userId: string, title: string, message: string, _options?: { url?: string }): Promise<void> {
    this.logger.log(
      `[STUB] Notification for user ${userId}: "${title}" — ${message}`,
    );
  }
}
