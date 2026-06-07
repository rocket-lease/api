-- vehicles.h3_cell: hex H3 materializado para lookups indexados de oferta y
-- demanda zonal. Se rellena en cada save desde lat/lon (ver
-- PostgresVehicleRepository) y se backfillea para filas existentes con el
-- script prisma/scripts/backfill-vehicle-h3.ts. Queda nullable: los
-- vehículos sin coordenadas no pertenecen a ningún hex.
ALTER TABLE "vehicles" ADD COLUMN "h3_cell" TEXT;
CREATE INDEX "vehicles_h3_cell_idx" ON "vehicles"("h3_cell");

-- price_quotes: índice para contar la señal `quote` por hex en la ventana de
-- demanda, y un índice dedicado a expires_at para el cron de cleanup (el
-- índice previo lideraba por vehicle_id y no servía para el barrido por
-- expiración).
CREATE INDEX "price_quotes_zone_time_idx" ON "price_quotes"("h3_cell", "created_at" DESC);
CREATE INDEX "price_quotes_expires_at_idx" ON "price_quotes"("expires_at");
