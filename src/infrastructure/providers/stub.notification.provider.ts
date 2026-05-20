import { Inject, Injectable } from '@nestjs/common';
import { NotificationProvider } from '@/domain/providers/notification.provider';
import { LOGGER, type Logger } from '@/application/logger.interface';

@Injectable()
export class StubNotificationProvider implements NotificationProvider {
  @Inject(LOGGER) private readonly logger: Logger;

  async notify(userId: string, title: string, message: string): Promise<void> {
    this.logger.info(
      `[STUB] Notification for user ${userId}: "${title}" — ${message}`,
    );
  }
}
