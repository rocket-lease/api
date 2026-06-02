-- US-26 (Reservar con seña) + US-30 (Pagar saldo de reserva señada) — parte 2/2
--
-- Idempotente: usa IF [NOT] EXISTS para poder re-aplicarse sin romper si una
-- corrida previa quedó a medias (p. ej. dropeó el EXCLUDE constraint y luego
-- falló al recrearlo, dejando la migración marcada como fallida).

-- 1) Columnas de tracking de pago parcial + deadline + recordatorio.
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "deposit_paid_cents"       INTEGER     NULL;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "deposit_paid_at"          TIMESTAMPTZ NULL;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "balance_due_at"           TIMESTAMPTZ NULL;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "balance_reminder_sent_at" TIMESTAMPTZ NULL;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "transfer_payment_mode"    TEXT        NULL;

ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_transfer_payment_mode_check";
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_transfer_payment_mode_check"
  CHECK (
    "transfer_payment_mode" IS NULL
    OR "transfer_payment_mode" IN ('full', 'deposit', 'balance')
  );

-- 2) Re-crear la EXCLUDE constraint incluyendo 'pending_balance', para que una
--    reserva señada siga bloqueando el calendario del vehículo (ADR-0004).
--    Garantizamos primero la extensión y la columna generada `period` de las
--    que depende el constraint: en bases sanas ya existen (no-op), pero algunas
--    instancias (p. ej. provisionadas contra Supabase) nunca materializaron ese
--    bloque de la migración original `add_reservations_table`.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "period" tstzrange
  GENERATED ALWAYS AS (tstzrange("start_at", "end_at", '[)')) STORED;
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_no_overlap";
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap"
  EXCLUDE USING gist ("vehicle_id" WITH =, "period" WITH &&)
  WHERE (status IN ('pending_payment', 'pending_balance', 'confirmed', 'in_progress'));

-- 3) Índices para los jobs de expiración de saldo y recordatorio 24h.
CREATE INDEX IF NOT EXISTS "reservations_pending_balance_due_idx"
  ON "reservations" ("balance_due_at")
  WHERE "status" = 'pending_balance';

CREATE INDEX IF NOT EXISTS "reservations_pending_balance_reminder_idx"
  ON "reservations" ("balance_due_at")
  WHERE "status" = 'pending_balance' AND "balance_reminder_sent_at" IS NULL;
