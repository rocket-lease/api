-- US-40: pending_approval status, auto-accept flags, rejection reason

-- AlterEnum: extend ReservationStatus with pending_approval
ALTER TYPE "ReservationStatus" ADD VALUE 'pending_approval';

-- Auto-accept flag at the rentador level (default: manual approval)
ALTER TABLE "users" ADD COLUMN "auto_accept" BOOLEAN NOT NULL DEFAULT false;

-- Per-vehicle override (null = inherit from owner)
ALTER TABLE "vehicles" ADD COLUMN "auto_accept" BOOLEAN;

-- Optional free text reason when a request is rejected
ALTER TABLE "reservations" ADD COLUMN "rejection_reason" VARCHAR(280);

-- Speeds up the TTL expiration job that scans pending_approval rows by age
CREATE INDEX "reservations_status_created_at_idx" ON "reservations"("status", "created_at");

-- NOTE: the EXCLUDE constraint reservations_no_overlap is intentionally NOT modified.
-- pending_approval requests are allowed to overlap (permissive concurrency, decision in ADR/PLAN-ATAQUE).
