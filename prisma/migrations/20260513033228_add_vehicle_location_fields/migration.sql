/*
  Warnings:

  - Added the required column `available_from` to the `vehicles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `vehicles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `province` to the `vehicles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "available_from" TEXT NOT NULL,
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "province" TEXT NOT NULL;
