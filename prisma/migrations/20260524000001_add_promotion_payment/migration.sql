ALTER TABLE "promotions_active"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "payment_method" TEXT NOT NULL DEFAULT 'credit_card',
  ADD COLUMN "paid_at" TIMESTAMP(3),
  ADD COLUMN "transaction_id" TEXT,
  ADD COLUMN "transfer_code" TEXT,
  ADD COLUMN "transfer_alias" TEXT,
  ADD COLUMN "transfer_expires_at" TIMESTAMP(3);

UPDATE "promotions_active" SET "status" = 'active', "payment_method" = 'credit_card';

ALTER TABLE "promotions_active" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "promotions_active" ALTER COLUMN "payment_method" DROP DEFAULT;
