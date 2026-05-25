-- Replace single-column index with composite (reservationId, sentAt, id)
-- for stable pagination ordering when multiple messages share the same sentAt.
DROP INDEX IF EXISTS "messages_reservation_sent_idx";

CREATE INDEX "messages_reservation_sent_id_idx"
  ON "messages"("reservation_id", "sent_at" ASC, "id" ASC);
