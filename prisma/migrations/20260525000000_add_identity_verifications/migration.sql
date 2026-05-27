-- CreateEnum
CREATE TYPE "IdentityVerificationStatus" AS ENUM ('not_started', 'pending', 'verified', 'rejected');

-- CreateTable
CREATE TABLE "identity_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "status" "IdentityVerificationStatus" NOT NULL DEFAULT 'not_started',
    "provider_name" TEXT,
    "provider_request_id" TEXT,
    "rejection_reason" VARCHAR(280),
    "submitted_at" TIMESTAMPTZ(6),
    "review_after_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6),
    "documents" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "identity_verifications_user_id_key" ON "identity_verifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "identity_verifications_provider_request_id_key" ON "identity_verifications"("provider_request_id");

-- CreateIndex
CREATE INDEX "identity_verifications_status_review_after_at_idx" ON "identity_verifications"("status", "review_after_at");

-- AddForeignKey
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;