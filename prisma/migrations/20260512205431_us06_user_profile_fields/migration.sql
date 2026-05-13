-- US-06: user profile fields
ALTER TABLE "users"
  ADD COLUMN "avatar_url" TEXT,
  ADD COLUMN "verification_status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "level" TEXT NOT NULL DEFAULT 'bronze',
  ADD COLUMN "reputation_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "preferred_transmission" TEXT,
  ADD COLUMN "preferred_accessibility" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "preferred_max_price_daily" INTEGER;
