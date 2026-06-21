-- Refactor máquina de estados de tickets: elimina sistema de disputas,
-- reemplaza 'rejected' por 'closed', y agrega impactos de resolución en wallet.
-- Los ADD VALUE de enum están en la migración anterior (20260613000000).

-- 1. Migrar tickets existentes 'rejected' → 'closed'
UPDATE "tickets" SET status = 'closed' WHERE status = 'rejected';

-- 2. Agregar columna ticket_id en wallet_movements (audit trail de resoluciones)
ALTER TABLE "wallet_movements"
  ADD COLUMN IF NOT EXISTS "ticket_id" TEXT;

ALTER TABLE "wallet_movements"
  ADD CONSTRAINT "wallet_movements_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Limpiar FK huérfana en wallet_movements primero (bloquea el DROP TABLE)
ALTER TABLE "wallet_movements"
  DROP CONSTRAINT IF EXISTS "wallet_movements_dispute_resolution_id_fkey",
  DROP COLUMN IF EXISTS "dispute_resolution_id";

-- 4. Eliminar tabla dispute_resolutions (ya sin dependencias)
DROP TABLE IF EXISTS "dispute_resolutions";
