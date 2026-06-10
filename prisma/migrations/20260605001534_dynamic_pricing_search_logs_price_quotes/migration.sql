ALTER TABLE "vehicles"
  ADD COLUMN "dynamic_pricing_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"
  ADD COLUMN "role" TEXT;

CREATE TABLE "price_quotes" (
  "id"                  UUID            NOT NULL DEFAULT gen_random_uuid(),
  "vehicle_id"          TEXT            NOT NULL,
  "conductor_id"        TEXT,
  "start_at"            TIMESTAMPTZ(6)  NOT NULL,
  "end_at"              TIMESTAMPTZ(6)  NOT NULL,
  "base_price_cents"    INTEGER         NOT NULL,
  "multiplier"          NUMERIC(4,3)    NOT NULL,
  "discount_percentage" INTEGER         NOT NULL DEFAULT 0,
  "delivery_fee_cents"  INTEGER         NOT NULL DEFAULT 0,
  "total_cents"         INTEGER         NOT NULL,
  "currency"            TEXT            NOT NULL,
  "h3_cell"             TEXT            NOT NULL,
  "created_at"          TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"          TIMESTAMPTZ(6)  NOT NULL,

  CONSTRAINT "price_quotes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_quotes_lookup_idx" ON "price_quotes"("vehicle_id", "expires_at");

ALTER TABLE "price_quotes"
  ADD CONSTRAINT "price_quotes_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_quotes"
  ADD CONSTRAINT "price_quotes_conductor_id_fkey"
  FOREIGN KEY ("conductor_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "search_logs" (
  "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
  "session_id"   TEXT           NOT NULL,
  "conductor_id" TEXT,
  "h3_cell"      TEXT           NOT NULL,
  "filters"      JSONB          NOT NULL,
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "search_logs_zone_time_idx"    ON "search_logs"("h3_cell",    "created_at" DESC);
CREATE INDEX "search_logs_session_time_idx" ON "search_logs"("session_id", "created_at" DESC);

ALTER TABLE "search_logs"
  ADD CONSTRAINT "search_logs_conductor_id_fkey"
  FOREIGN KEY ("conductor_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
