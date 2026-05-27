/*
  Warnings:

  - The primary key for the `identity_verifications` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- CreateEnum
CREATE TYPE "VehicleDocumentVerificationStatus" AS ENUM ('pending', 'verified', 'rejected');

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_reservation_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_id_fkey";

-- AlterTable
ALTER TABLE "bank_accounts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "identity_verifications" DROP CONSTRAINT "identity_verifications_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "vehicle_document_verifications" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "rentador_id" TEXT NOT NULL,
    "status" "VehicleDocumentVerificationStatus" NOT NULL DEFAULT 'pending',
    "documents" JSONB NOT NULL DEFAULT '{}',
    "rejection_reason" VARCHAR(280),
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehicle_document_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_document_verifications_vehicle_id_key" ON "vehicle_document_verifications"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_document_verifications_status_submitted_at_idx" ON "vehicle_document_verifications"("status", "submitted_at");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_document_verifications" ADD CONSTRAINT "vehicle_document_verifications_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "messages_reservation_sent_id_idx" RENAME TO "messages_reservation_id_sent_at_id_idx";
