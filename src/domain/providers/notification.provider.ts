export interface NotifyOptions {
  url?: string;
  /** Reemplaza en el dispositivo cualquier notificación previa con el mismo tag. */
  tag?: string;
  /** Mantiene la notificación fija hasta que el usuario la atienda (alertas importantes). */
  requireInteraction?: boolean;
  /** URL de una imagen asociada (p. ej. la foto del vehículo) para el centro in-app. */
  imageUrl?: string | null;
  /**
   * Persiste la notificación en el centro in-app pero no la emite por push. Para
   * eventos que el propio usuario acaba de provocar dentro de la app, donde el
   * push sería redundante.
   */
  inAppOnly?: boolean;
  /**
   * Cantidad de no leídas para reflejar en el badge del ícono de la app. Lo
   * completa internamente el provider que persiste; los callers no lo setean.
   */
  unreadCount?: number;
}

export interface NotificationProvider {
  notify(userId: string, title: string, message: string, options?: NotifyOptions): Promise<void>;
}

export const NOTIFICATION_PROVIDER = Symbol('NotificationProvider');
