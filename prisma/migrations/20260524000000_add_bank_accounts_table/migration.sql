CREATE TABLE "bank_accounts" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "cbu" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_verified" BOOLEAN NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_accounts_owner_id_deleted_at_idx" ON "bank_accounts"("owner_id", "deleted_at");

ALTER TABLE "bank_accounts"
  ADD CONSTRAINT "bank_accounts_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
