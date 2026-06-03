CREATE TYPE "TicketType" AS ENUM ('vehicle_issue', 'counterpart_report');

ALTER TABLE "tickets"
  ADD COLUMN "type" "TicketType" NOT NULL DEFAULT 'vehicle_issue';
