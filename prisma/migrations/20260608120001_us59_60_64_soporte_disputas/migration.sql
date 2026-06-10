-- US-59/60/64: soporte general (tickets sin reserva), chat de tickets,
-- rol admin y disputas con penalización económica.

-- 1. Tickets: soporte general + asunto + calificación
ALTER TABLE "tickets"
  ALTER COLUMN "reservation_id" DROP NOT NULL,
  ALTER COLUMN "reported_by" DROP NOT NULL,
  ADD COLUMN "subject" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "rating" SMALLINT;

ALTER TABLE "tickets" DROP CONSTRAINT "tickets_reservation_id_reported_by_key";

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_rating_range"
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- 2. Chat de tickets (independiente del chat de reservas)
CREATE TABLE "ticket_messages" (
  "id"         TEXT           NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "ticket_id"  TEXT           NOT NULL,
  "sender_id"  TEXT           NOT NULL,
  "body"       TEXT           NOT NULL,
  "sent_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ticket_messages_ticket_id_sent_at_id_idx"
  ON "ticket_messages" ("ticket_id", "sent_at", "id");

ALTER TABLE "ticket_messages"
  ADD CONSTRAINT "ticket_messages_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_messages"
  ADD CONSTRAINT "ticket_messages_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Rol admin (mismo patrón que isConductor/isRentador: flag sobre User)
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- 4. Disputas
CREATE TABLE "dispute_resolutions" (
  "id"                     TEXT              NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "ticket_id"              TEXT              NOT NULL,
  "status"                 "DisputeStatus"   NOT NULL DEFAULT 'escalated',
  "moderator_id"           TEXT,
  "info_requested_at"      TIMESTAMPTZ(6),
  "info_deadline_at"       TIMESTAMPTZ(6),
  "verdict"                TEXT,
  "responsible_user_id"    TEXT,
  "penalty_type"           "PenaltyType",
  "penalty_amount_cents"   INTEGER,
  "penalty_percentage"     DOUBLE PRECISION,
  "ruled_at"               TIMESTAMPTZ(6),
  "appeal_count"           SMALLINT          NOT NULL DEFAULT 0,
  "created_at"             TIMESTAMPTZ(6)    NOT NULL DEFAULT now(),
  "updated_at"             TIMESTAMPTZ(6)    NOT NULL DEFAULT now(),

  CONSTRAINT "dispute_resolutions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dispute_resolutions_ticket_id_key" UNIQUE ("ticket_id")
);

ALTER TABLE "dispute_resolutions"
  ADD CONSTRAINT "dispute_resolutions_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dispute_resolutions"
  ADD CONSTRAINT "dispute_resolutions_moderator_id_fkey"
  FOREIGN KEY ("moderator_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dispute_resolutions"
  ADD CONSTRAINT "dispute_resolutions_responsible_user_id_fkey"
  FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Penalizaciones de disputa en wallet (mismo patrón que reservation_id/withdrawal_id: FK opcional por tipo)
ALTER TABLE "wallet_movements"
  ADD COLUMN "dispute_resolution_id" TEXT;

ALTER TABLE "wallet_movements"
  ADD CONSTRAINT "wallet_movements_dispute_resolution_id_key" UNIQUE ("dispute_resolution_id");

ALTER TABLE "wallet_movements"
  ADD CONSTRAINT "wallet_movements_dispute_resolution_id_fkey"
  FOREIGN KEY ("dispute_resolution_id") REFERENCES "dispute_resolutions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
