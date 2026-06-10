/*
  Warnings:

  - A unique constraint covering the columns `[reservation_id,reviewer_id,target_type]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "reviews_reservation_id_key";

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "owner_reputation_score" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reputations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "score_as_driver" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_as_renter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "review_count_as_driver" INTEGER NOT NULL DEFAULT 0,
    "review_count_as_renter" INTEGER NOT NULL DEFAULT 0,
    "penalty_count_as_driver" INTEGER NOT NULL DEFAULT 0,
    "penalty_count_as_renter" INTEGER NOT NULL DEFAULT 0,
    "suspended_as_driver" BOOLEAN NOT NULL DEFAULT false,
    "suspended_as_renter" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reputations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalties" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "score_deduction" DOUBLE PRECISION NOT NULL,
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reputations_user_id_key" ON "reputations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "penalties_ticket_id_key" ON "penalties"("ticket_id");

-- CreateIndex
CREATE INDEX "penalties_user_id_idx" ON "penalties"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_reservation_id_reviewer_id_target_type_key" ON "reviews"("reservation_id", "reviewer_id", "target_type");

-- AddForeignKey
ALTER TABLE "reputations" ADD CONSTRAINT "reputations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
