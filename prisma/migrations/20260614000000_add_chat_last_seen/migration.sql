-- CreateTable: chat_last_seen
-- Persiste el timestamp de última lectura por usuario por reserva.
-- Fix definitivo para web#114 (mensajes no leídos).

CREATE TABLE "chat_last_seen" (
    "reservation_id" TEXT NOT NULL,
    "user_id"        TEXT NOT NULL,
    "last_seen_at"   TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_last_seen_pkey" PRIMARY KEY ("reservation_id", "user_id")
);

ALTER TABLE "chat_last_seen"
    ADD CONSTRAINT "chat_last_seen_reservation_id_fkey"
    FOREIGN KEY ("reservation_id")
    REFERENCES "reservations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_last_seen"
    ADD CONSTRAINT "chat_last_seen_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
