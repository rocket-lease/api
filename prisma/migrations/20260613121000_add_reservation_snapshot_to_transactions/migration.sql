-- Step 1: Add new columns (nullable initially for the backfill)
ALTER TABLE "experience_transactions"
  ADD COLUMN "reservation_id" TEXT,
  ADD COLUMN "reservation_vehicle_name" TEXT,
  ADD COLUMN "reservation_vehicle_id" TEXT,
  ADD COLUMN "reservation_start_at" TIMESTAMPTZ(6),
  ADD COLUMN "reservation_end_at" TIMESTAMPTZ(6);

-- Step 2: Backfill from reservations table for existing rows
-- source_id holds the reservation UUID, source='reservation' or 'review'
UPDATE "experience_transactions" AS tx
SET
  "reservation_id" = tx."source_id",
  "reservation_vehicle_name" = v.brand || ' ' || v.model,
  "reservation_vehicle_id" = r."vehicle_id",
  "reservation_start_at" = r."start_at",
  "reservation_end_at" = r."end_at"
FROM "reservations" AS r
JOIN "vehicles" AS v ON v.id = r."vehicle_id"
WHERE tx."source_id" = r.id;

-- Step 3: Make new columns NOT NULL after backfill
ALTER TABLE "experience_transactions"
  ALTER COLUMN "reservation_id" SET NOT NULL,
  ALTER COLUMN "reservation_vehicle_name" SET NOT NULL,
  ALTER COLUMN "reservation_vehicle_id" SET NOT NULL,
  ALTER COLUMN "reservation_start_at" SET NOT NULL,
  ALTER COLUMN "reservation_end_at" SET NOT NULL;

-- Step 4: Drop old columns and unique constraint
DROP INDEX IF EXISTS "experience_transactions_profile_id_source_source_id_key";
ALTER TABLE "experience_transactions"
  DROP COLUMN "source",
  DROP COLUMN "source_id";

-- Step 5: Add new index for reservation lookups
CREATE INDEX "experience_transactions_profile_id_reservation_id_idx"
  ON "experience_transactions"("profile_id", "reservation_id");

-- Step 6: Update existing pending rows to set source='reservation' semantic
-- (no-op, status stays 'pending')
