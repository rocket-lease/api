import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NotificationProvider, NotifyOptions } from '@/domain/providers/notification.provider';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '@/domain/repositories/notification.repository';
import { WebPushNotificationProvider } from '@/infrastructure/providers/web-push.notification.provider';

/**
 * Notification provider que persiste cada evento en el centro de notificaciones
 * in-app y luego intenta enviarlo por web push. La persistencia ocurre siempre,
 * de modo que el evento queda registrado aunque el usuario tenga las
 * notificaciones push deshabilitadas.
 *
 * Ambas etapas son best-effort: una falla al persistir o al enviar el push se
 * registra pero nunca se propaga, para no tumbar la operación de dominio que
 * disparó la notificación (un pago confirmado no debe fallar porque el centro de
 * notificaciones esté caído).
 */
@Injectable()
export class PersistingNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(PersistingNotificationProvider.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly repository: NotificationRepository,
    private readonly webPush: WebPushNotificationProvider,
  ) {}

  async notify(
    userId: string,
    title: string,
    message: string,
    options?: NotifyOptions,
  ): Promise<void> {
    try {
      await this.repository.save({
        userId,
        title,
        body: message,
        url: options?.url ?? null,
        imageUrl: options?.imageUrl ?? null,
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist in-app notification for user ${userId}: ${String(err)}`,
      );
    }

    if (options?.inAppOnly) return;

    try {
      const unreadCount = await this.repository.countUnread(userId);
      await this.webPush.notify(userId, title, message, { ...options, unreadCount });
    } catch (err) {
      this.logger.warn(`Failed to dispatch web push for user ${userId}: ${String(err)}`);
    }
  }
}
