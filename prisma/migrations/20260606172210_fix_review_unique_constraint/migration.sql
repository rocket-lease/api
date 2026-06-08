-- AlterTable
ALTER TABLE "vehicle_discount_tiers" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "reviews_target_type_reviewed_id_idx" ON "reviews"("target_type", "reviewed_id");
