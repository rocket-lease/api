CREATE TYPE "TicketStatus" AS ENUM ('open', 'under_review', 'resolved', 'rejected');
CREATE TYPE "TicketReportedBy" AS ENUM ('conductor', 'rentador');

CREATE TABLE "tickets" (
  "id"             UUID               NOT NULL DEFAULT gen_random_uuid(),
  "reservation_id" UUID               NOT NULL,
  "reported_by"    "TicketReportedBy" NOT NULL,
  "reporter_id"    TEXT               NOT NULL,
  "status"         "TicketStatus"     NOT NULL DEFAULT 'open',
  "description"    TEXT               NOT NULL,
  "photo_urls"     TEXT[]             NOT NULL DEFAULT '{}',
  "created_at"     TIMESTAMPTZ(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMPTZ(6)     NOT NULL,

  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tickets_reservation_id_reported_by_key" UNIQUE ("reservation_id", "reported_by")
);

CREATE INDEX "tickets_reporter_id_idx" ON "tickets"("reporter_id");

ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_reservation_id_fkey"
  FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
