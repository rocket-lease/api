-- Reservations: status enum
CREATE TYPE "ReservationStatus" AS ENUM (
  'pending_payment',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
  'expired'
);

-- Payment method enum (mocked, no real gateway)
CREATE TYPE "PaymentMethod" AS ENUM (
  'credit_card',
  'debit_card',
  'bank_transfer'
);

-- Reservations table
CREATE TABLE "reservations" (
  "id"                    TEXT PRIMARY KEY,
  "vehicle_id"            TEXT NOT NULL,
  "conductor_id"          TEXT NOT NULL,
  "rentador_id"           TEXT NOT NULL,
  "status"                "ReservationStatus" NOT NULL DEFAULT 'pending_payment',
  "start_at"              TIMESTAMPTZ(6) NOT NULL,
  "end_at"                TIMESTAMPTZ(6) NOT NULL,
  "hold_expires_at"       TIMESTAMPTZ(6),
  "total_cents"           INTEGER NOT NULL,
  "currency"              TEXT NOT NULL DEFAULT 'ARS',
  "payment_method"        "PaymentMethod",
  "contract_accepted_at"  TIMESTAMPTZ(6),
  "paid_at"               TIMESTAMPTZ(6),
  "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "reservations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservations_conductor_id_fkey" FOREIGN KEY ("conductor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "reservations_vehicle_id_status_idx" ON "reservations"("vehicle_id", "status");
CREATE INDEX "reservations_conductor_id_idx" ON "reservations"("conductor_id");

-- ADR-0004: prevent overlapping reservations on the same vehicle in DB
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservations"
  ADD COLUMN "period" tstzrange GENERATED ALWAYS AS (tstzrange("start_at", "end_at", '[)')) STORED;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap"
  EXCLUDE USING gist ("vehicle_id" WITH =, "period" WITH &&)
  WHERE (status IN ('pending_payment', 'confirmed', 'in_progress'));
