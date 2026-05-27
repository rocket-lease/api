-- CreateTable
CREATE TABLE "promotions_active" (
    "vehicle_id" TEXT NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "discount_percentage" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_active_pkey" PRIMARY KEY ("vehicle_id")
);

-- CreateTable
CREATE TABLE "promotion_length_in_days" (
    "days" INTEGER NOT NULL,
    "value_in_cents" INTEGER NOT NULL,

    CONSTRAINT "promotion_length_in_days_pkey" PRIMARY KEY ("days")
);

-- CreateTable
CREATE TABLE "promotion_percentages" (
    "percentage" INTEGER NOT NULL,
    "value_in_cents" INTEGER NOT NULL,

    CONSTRAINT "promotion_percentages_pkey" PRIMARY KEY ("percentage")
);

-- AddForeignKey
ALTER TABLE "promotions_active"
ADD CONSTRAINT "promotions_active_vehicle_id_fkey"
FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
