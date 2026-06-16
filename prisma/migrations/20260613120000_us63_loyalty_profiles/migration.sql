-- CreateTable
CREATE TABLE "loyalty_profiles" (
    "id" TEXT NOT NULL,
    "conductor_id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'bronze',
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "pending_xp" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loyalty_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_transactions" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experience_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_profiles_conductor_id_key" ON "loyalty_profiles"("conductor_id");

-- CreateIndex
CREATE UNIQUE INDEX "experience_transactions_profile_id_source_source_id_key" ON "experience_transactions"("profile_id", "source", "source_id");

-- CreateIndex
CREATE INDEX "experience_transactions_profile_id_status_idx" ON "experience_transactions"("profile_id", "status");

-- AddForeignKey
ALTER TABLE "loyalty_profiles" ADD CONSTRAINT "loyalty_profiles_conductor_id_fkey" FOREIGN KEY ("conductor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_transactions" ADD CONSTRAINT "experience_transactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "loyalty_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migration data: set existing non-null levels to bronze
UPDATE "users" SET "level" = 'bronze' WHERE "level" IS NOT NULL;
