-- US-53: Cargo por entrega/retiro a domicilio
-- Agrega campos de home delivery/return a vehículos y reservas.

ALTER TABLE "vehicles"
  ADD COLUMN "home_delivery_enabled"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "home_delivery_fee_cents"  INTEGER,
  ADD COLUMN "home_return_enabled"      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "home_return_fee_cents"    INTEGER;

ALTER TABLE "reservations"
  ADD COLUMN "with_home_delivery"                BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "home_delivery_fee_cents_snapshot"  INTEGER,
  ADD COLUMN "delivery_address"                  TEXT,
  ADD COLUMN "delivery_latitude"                 DOUBLE PRECISION,
  ADD COLUMN "delivery_longitude"                DOUBLE PRECISION,
  ADD COLUMN "with_home_return"                  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "home_return_fee_cents_snapshot"    INTEGER,
  ADD COLUMN "return_address"                    TEXT,
  ADD COLUMN "return_latitude"                   DOUBLE PRECISION,
  ADD COLUMN "return_longitude"                  DOUBLE PRECISION;
