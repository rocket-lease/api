export interface NotifyOptions {
  url?: string;
  /** Reemplaza en el dispositivo cualquier notificación previa con el mismo tag. */
  tag?: string;
  /** Mantiene la notificación fija hasta que el usuario la atienda (alertas importantes). */
  requireInteraction?: boolean;
}

export interface NotificationProvider {
  notify(userId: string, title: string, message: string, options?: NotifyOptions): Promise<void>;
}

export const NOTIFICATION_PROVIDER = Symbol('NotificationProvider');
