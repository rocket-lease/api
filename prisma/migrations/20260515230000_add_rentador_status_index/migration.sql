-- CreateIndex
CREATE INDEX "reservations_rentador_id_status_idx" ON "reservations"("rentador_id", "status");
