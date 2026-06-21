/*
  Warnings:

  - The foreign key `reviews_reviewed_id_fkey` on `reviews` references `users` but
    `reviewed_id` can now be a vehicle UUID. Removed the FK constraint.
*/

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_reviewed_id_fkey";
