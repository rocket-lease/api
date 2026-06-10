CREATE TABLE "location_geometries" (
  "location_id" TEXT NOT NULL,
  "geometry"    JSONB NOT NULL,
  "source"      TEXT NOT NULL,
  "version"     TEXT NOT NULL,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "location_geometries_pkey" PRIMARY KEY ("location_id")
);

ALTER TABLE "location_geometries"
  ADD CONSTRAINT "location_geometries_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
