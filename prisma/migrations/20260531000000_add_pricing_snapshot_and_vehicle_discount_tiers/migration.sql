-- Add pricing snapshots and vehicle discount tiers for the long-rental discount feature.

ALTER TABLE "reservations"
  ADD COLUMN "pricing_snapshot" JSONB NULL;

CREATE TABLE "vehicle_discount_tiers" (
  "id" TEXT NOT NULL,
  "vehicle_id" TEXT NOT NULL,
  "minimum_days" INTEGER NOT NULL,
  "discount_percentage" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vehicle_discount_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vehicle_discount_tiers_vehicle_id_minimum_days_key"
  ON "vehicle_discount_tiers"("vehicle_id", "minimum_days");

CREATE INDEX "vehicle_discount_tiers_vehicle_id_minimum_days_idx"
  ON "vehicle_discount_tiers"("vehicle_id", "minimum_days");

ALTER TABLE "vehicle_discount_tiers"
  ADD CONSTRAINT "vehicle_discount_tiers_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;