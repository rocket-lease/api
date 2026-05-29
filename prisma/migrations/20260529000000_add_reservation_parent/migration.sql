-- Self-relation que materializa la "cadena" (chain) de reservas: el padre
-- es la reserva original confirmada y cada eslabón posterior cuelga del
-- anterior. Permite reusar la state machine + EXCLUDE constraint de
-- reservations sin introducir una entity nueva para extensiones.

-- AlterTable
ALTER TABLE "reservations"
  ADD COLUMN "parent_reservation_id" TEXT;

-- AddForeignKey
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_parent_reservation_id_fkey"
  FOREIGN KEY ("parent_reservation_id")
  REFERENCES "reservations"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "reservations_parent_reservation_id_idx"
  ON "reservations"("parent_reservation_id");
