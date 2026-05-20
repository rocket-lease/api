-- CreateEnum
CREATE TYPE "CancellationPolicy" AS ENUM ('FLEXIBLE', 'MODERATE', 'STRICT');

-- CreateEnum
CREATE TYPE "Deposit" AS ENUM ('NONE', 'TEN_PERCENT', 'FIFTY_PERCENT');

-- CreateEnum
CREATE TYPE "MaxKilometrageType" AS ENUM ('UNLIMITED', 'LIMITED');

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "reservation_rule_set_id" TEXT;

-- CreateTable
CREATE TABLE "reservation_rule_sets" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cancellation_policy" "CancellationPolicy" NOT NULL,
    "deposit" "Deposit" NOT NULL,
    "max_kilometrage_type" "MaxKilometrageType" NOT NULL,
    "max_kilometrage_value" INTEGER,
    "min_rental_days" INTEGER,
    "max_rental_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_rule_sets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_reservation_rule_set_id_fkey" FOREIGN KEY ("reservation_rule_set_id") REFERENCES "reservation_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_rule_sets" ADD CONSTRAINT "reservation_rule_sets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
