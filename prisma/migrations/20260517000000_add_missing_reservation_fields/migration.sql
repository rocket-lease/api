-- Add missing enum values
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'digital_wallet';

-- Add missing columns to reservations
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "wallet_provider" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "transfer_code" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "transfer_expires_at" TIMESTAMPTZ(6);

-- Add missing index on rentador_id + status
CREATE INDEX IF NOT EXISTS "reservations_rentador_id_status_idx" ON "reservations"("rentador_id", "status");
