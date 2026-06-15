const ARS_FORMATTER = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

const DATE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Formatea un monto en centavos como moneda argentina para mostrar en el texto
 * de una notificación (p. ej. `1500000` → `"$15.000,00"`).
 */
export function formatArs(cents: number): string {
  return ARS_FORMATTER.format(cents / 100);
}

/**
 * Formatea una fecha en la zona horaria de Buenos Aires de forma legible para el
 * texto de una notificación (p. ej. `"20 de junio, 14:30"`).
 */
export function formatNotificationDate(date: Date): string {
  return DATE_FORMATTER.format(date);
}
