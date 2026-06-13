-- Refactor máquina de estados de tickets: elimina sistema de disputas,
-- reemplaza 'rejected' por 'closed', y agrega impactos de resolución en wallet.

-- 1. Nuevo estado 'closed' en TicketStatus (ADD VALUE es irreversible en Postgres)
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'closed';

-- 2. Migrar tickets existentes 'rejected' → 'closed'
-- (ejecutar después de ADD VALUE para que el valor exista)
UPDATE "tickets" SET status = 'closed' WHERE status = 'rejected';

-- 3. Nuevos tipos de movimiento de wallet para resoluciones de tickets
ALTER TYPE "WalletMovementType" ADD VALUE IF NOT EXISTS 'ticket_resolution_credit';
ALTER TYPE "WalletMovementType" ADD VALUE IF NOT EXISTS 'ticket_resolution_debit';

-- 4. Agregar columna ticket_id en wallet_movements (audit trail de resoluciones)
ALTER TABLE "wallet_movements"
  ADD COLUMN IF NOT EXISTS "ticket_id" TEXT;

ALTER TABLE "wallet_movements"
  ADD CONSTRAINT "wallet_movements_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Eliminar tabla dispute_resolutions
--    (la FK desde wallet_movements.dispute_resolution_id queda como columna huérfana
--     hasta que el código deje de usarla; se puede dropear en sprint posterior)
DROP TABLE IF EXISTS "dispute_resolutions";

-- 6. Limpiar FK huérfana en wallet_movements
ALTER TABLE "wallet_movements"
  DROP CONSTRAINT IF EXISTS "wallet_movements_dispute_resolution_id_fkey",
  DROP COLUMN IF EXISTS "dispute_resolution_id";
