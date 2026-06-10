CREATE TABLE "locations" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "parent_id" TEXT,
  "province_code" TEXT,
  "city_name" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "center_lat" DOUBLE PRECISION,
  "center_lng" DOUBLE PRECISION,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "location_h3_cells" (
  "location_id" TEXT NOT NULL,
  "h3_cell" TEXT NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "location_h3_cells_pkey" PRIMARY KEY ("location_id", "h3_cell")
);

ALTER TABLE "search_logs"
  ADD COLUMN "location_id" TEXT,
  ADD COLUMN "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  ALTER COLUMN "h3_cell" DROP NOT NULL;

CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");
CREATE INDEX "locations_parent_id_display_order_idx" ON "locations"("parent_id", "display_order");
CREATE INDEX "locations_enabled_display_order_idx" ON "locations"("enabled", "display_order");
CREATE INDEX "location_h3_cells_h3_cell_idx" ON "location_h3_cells"("h3_cell");
CREATE INDEX "search_logs_location_time_idx" ON "search_logs"("location_id", "created_at" DESC);

ALTER TABLE "locations"
  ADD CONSTRAINT "locations_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "location_h3_cells"
  ADD CONSTRAINT "location_h3_cells_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "search_logs"
  ADD CONSTRAINT "search_logs_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
