/*
  Warnings:

  - The primary key for the `push_subscriptions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `period` on the `reservations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "push_subscriptions" DROP CONSTRAINT "push_subscriptions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "reservations" DROP COLUMN "period";

-- AlterTable
ALTER TABLE "withdrawals" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "wallet_movements_withdrawal_id_idx" ON "wallet_movements"("withdrawal_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewed_id_fkey" FOREIGN KEY ("reviewed_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
