-- Nuevos valores de enum para el refactor de tickets.
-- Separado en su propia migración porque Postgres no permite usar un valor
-- de enum recién agregado dentro de la misma transacción que lo crea.

DO $$ BEGIN
  ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'closed';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "WalletMovementType" ADD VALUE IF NOT EXISTS 'ticket_resolution_credit';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "WalletMovementType" ADD VALUE IF NOT EXISTS 'ticket_resolution_debit';
EXCEPTION WHEN others THEN NULL;
END $$;
