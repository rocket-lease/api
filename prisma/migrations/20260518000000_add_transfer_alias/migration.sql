-- Add transfer_alias column to reservations
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "transfer_alias" TEXT;
