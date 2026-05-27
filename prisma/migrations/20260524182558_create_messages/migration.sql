CREATE TABLE "messages" (
  "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "reservation_id" TEXT        NOT NULL,
  "sender_id"      TEXT        NOT NULL,
  "body"           TEXT        NOT NULL,
  "sent_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messages_reservation_id_fkey"
    FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE,
  CONSTRAINT "messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id")
);

CREATE INDEX "messages_reservation_sent_idx"
  ON "messages"("reservation_id", "sent_at" ASC);
