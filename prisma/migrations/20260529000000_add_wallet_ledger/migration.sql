-- CreateEnum
CREATE TYPE "WalletMovementType" AS ENUM ('reservation_credit', 'withdrawal_debit');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('processing', 'processed', 'failed');

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "bank_account_alias" TEXT NOT NULL,
    "bank_account_masked_cbu" TEXT NOT NULL,
    "bank_account_provider" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "provider_name" TEXT NOT NULL,
    "provider_transaction_id" TEXT NOT NULL,
    "provider_status" "WithdrawalStatus" NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'processed',
    "provider_metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "balance_after_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_movements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "WalletMovementType" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "reservation_id" TEXT,
    "withdrawal_id" TEXT,
    "provider_transaction_id" TEXT,
    "bank_account_id" TEXT,
    "bank_account_alias" TEXT,
    "bank_account_masked_cbu" TEXT,
    "provider_status" "WithdrawalStatus",
    "balance_after_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "withdrawals_provider_transaction_id_key" ON "withdrawals"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "withdrawals_user_id_created_at_idx" ON "withdrawals"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_movements_reservation_id_key" ON "wallet_movements"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_movements_withdrawal_id_key" ON "wallet_movements"("withdrawal_id");

-- CreateIndex
CREATE INDEX "wallet_movements_user_id_created_at_idx" ON "wallet_movements"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "withdrawals"
  ADD CONSTRAINT "withdrawals_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals"
  ADD CONSTRAINT "withdrawals_bank_account_id_fkey"
  FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_movements"
  ADD CONSTRAINT "wallet_movements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_movements"
  ADD CONSTRAINT "wallet_movements_reservation_id_fkey"
  FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_movements"
  ADD CONSTRAINT "wallet_movements_withdrawal_id_fkey"
  FOREIGN KEY ("withdrawal_id") REFERENCES "withdrawals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_movements"
  ADD CONSTRAINT "wallet_movements_bank_account_id_fkey"
  FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
