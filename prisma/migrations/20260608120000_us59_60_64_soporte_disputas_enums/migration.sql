-- US-59/60/64: nuevos valores de enum (deben aplicarse en una migración separada
-- de las sentencias que los usan, porque Postgres no permite usar un valor de
-- enum recién agregado dentro de la misma transacción que lo crea).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketType') THEN
    CREATE TYPE "TicketType" AS ENUM ('vehicle_issue', 'counterpart_report', 'support_request');
  ELSE
    ALTER TYPE "TicketType" ADD VALUE IF NOT EXISTS 'support_request';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletMovementType') THEN
    CREATE TYPE "WalletMovementType" AS ENUM ('reservation_credit', 'withdrawal_debit', 'dispute_penalty_debit', 'dispute_penalty_credit');
  ELSE
    BEGIN
      ALTER TYPE "WalletMovementType" ADD VALUE IF NOT EXISTS 'dispute_penalty_debit';
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
      ALTER TYPE "WalletMovementType" ADD VALUE IF NOT EXISTS 'dispute_penalty_credit';
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE "DisputeStatus" AS ENUM ('escalated', 'awaiting_info', 'ruled', 'appealed', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PenaltyType" AS ENUM ('fixed', 'percentage');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
