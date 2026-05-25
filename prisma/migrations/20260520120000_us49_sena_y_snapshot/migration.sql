-- US-49: Seña por porcentaje + snapshot inmutable de reglas en Reservation.
--
-- Migración compuesta en 6 pasos:
--   1) Agregar deposit_percentage a reservation_rule_sets.
--   2) Migrar los datos del enum Deposit (TEN_PERCENT→10, FIFTY_PERCENT→50, NONE→NULL).
--   3) Dropear la columna deposit y el enum Deposit.
--   4) Agregar vehicle_id (set privado) con UNIQUE + FK ON DELETE CASCADE.
--   5) Agregar 7 columnas de snapshot a reservations.
--   6) Backfill best-effort de los snapshots para reservas existentes.
--
-- Nota: las reservas pre-migración pueden quedar con valores levemente
-- distintos a los originales si el set ya había sido modificado antes de
-- esta migración. Aceptable para datos de desarrollo / staging.

-- Paso 1: nueva columna deposit_percentage con CHECK constraint.
ALTER TABLE "reservation_rule_sets"
  ADD COLUMN "deposit_percentage" INTEGER NULL;
ALTER TABLE "reservation_rule_sets"
  ADD CONSTRAINT "reservation_rule_sets_deposit_percentage_check"
  CHECK (
    "deposit_percentage" IS NULL
    OR ("deposit_percentage" BETWEEN 10 AND 50)
  );

-- Paso 2: migración de datos del enum a integer.
UPDATE "reservation_rule_sets" SET "deposit_percentage" = 10 WHERE "deposit" = 'TEN_PERCENT';
UPDATE "reservation_rule_sets" SET "deposit_percentage" = 50 WHERE "deposit" = 'FIFTY_PERCENT';
-- 'NONE' queda NULL.

-- Paso 3: dropear columna y enum viejos.
ALTER TABLE "reservation_rule_sets" DROP COLUMN "deposit";
DROP TYPE "Deposit";

-- Paso 4: vehicle_id (set privado) — UNIQUE + FK con cascade.
ALTER TABLE "reservation_rule_sets"
  ADD COLUMN "vehicle_id" TEXT NULL;
ALTER TABLE "reservation_rule_sets"
  ADD CONSTRAINT "reservation_rule_sets_vehicle_id_key" UNIQUE ("vehicle_id");
ALTER TABLE "reservation_rule_sets"
  ADD CONSTRAINT "reservation_rule_sets_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Paso 5: snapshots en reservations. DEFAULT solo para migration safety
-- (las reservas nuevas siempre setean los snapshots al confirmar pago).
ALTER TABLE "reservations" ADD COLUMN "deposit_percentage_snapshot" INTEGER NULL;
ALTER TABLE "reservations" ADD COLUMN "base_price_cents_snapshot" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "reservations" ADD COLUMN "cancellation_policy_snapshot" TEXT NOT NULL DEFAULT 'FLEXIBLE';
ALTER TABLE "reservations" ADD COLUMN "max_kilometrage_type_snapshot" TEXT NOT NULL DEFAULT 'UNLIMITED';
ALTER TABLE "reservations" ADD COLUMN "max_kilometrage_value_snapshot" INTEGER NULL;
ALTER TABLE "reservations" ADD COLUMN "min_rental_days_snapshot" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "reservations" ADD COLUMN "max_rental_days_snapshot" INTEGER NULL;

-- Paso 6: backfill best-effort de snapshots para reservations existentes
-- usando el set + precio actual del vehículo. Reservas pre-migración pueden
-- quedar inconsistentes si el set ya había sido modificado; documentado.
UPDATE "reservations" r SET
  "deposit_percentage_snapshot" = rrs."deposit_percentage",
  "cancellation_policy_snapshot" = rrs."cancellation_policy"::text,
  "max_kilometrage_type_snapshot" = rrs."max_kilometrage_type"::text,
  "max_kilometrage_value_snapshot" = rrs."max_kilometrage_value",
  "min_rental_days_snapshot" = COALESCE(rrs."min_rental_days", 1),
  "max_rental_days_snapshot" = rrs."max_rental_days"
FROM "vehicles" v
INNER JOIN "reservation_rule_sets" rrs
  ON v."reservation_rule_set_id" = rrs."id"
WHERE r."vehicle_id" = v."id";

UPDATE "reservations" r SET "base_price_cents_snapshot" = v."base_price_cents"
FROM "vehicles" v WHERE r."vehicle_id" = v."id";
