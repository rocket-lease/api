-- AlterTable
ALTER TABLE "reservations"
  ADD COLUMN "return_qr_token" UUID,
  ADD COLUMN "started_at"     TIMESTAMPTZ(6),
  ADD COLUMN "completed_at"   TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "reservations_return_qr_token_key"
  ON "reservations"("return_qr_token");
