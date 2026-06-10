-- Add channel_participant_id and message_type to ticket_messages
ALTER TABLE "ticket_messages"
  ADD COLUMN "channel_participant_id" UUID,
  ADD COLUMN "message_type" TEXT NOT NULL DEFAULT 'user';

-- Backfill existing messages: assign to the ticket reporter's channel
UPDATE "ticket_messages" tm
SET "channel_participant_id" = t."reporter_id"
FROM "tickets" t
WHERE tm."ticket_id" = t."id"
  AND tm."channel_participant_id" IS NULL;

-- After backfill, enforce NOT NULL
ALTER TABLE "ticket_messages"
  ALTER COLUMN "channel_participant_id" SET NOT NULL;

-- Drop the DEFAULT (new rows must always supply the value)
ALTER TABLE "ticket_messages"
  ALTER COLUMN "channel_participant_id" DROP DEFAULT;

-- Index for efficient per-channel queries
CREATE INDEX "ticket_messages_channel_idx" ON "ticket_messages" ("ticket_id", "channel_participant_id", "sent_at");
