-- CreateEnum
CREATE TYPE "Characteristic" AS ENUM ('GPS', 'BABY_SEAT', 'SUNROOF', 'PET_FRIENDLY', 'WIFI', 'USB_CHARGER', 'AUX_CABLE', 'BLUETOOTH');

-- CreateTable
CREATE TABLE "vehicle_characteristics" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "characteristic" "Characteristic" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_characteristics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_characteristics_vehicle_id_characteristic_key" ON "vehicle_characteristics"("vehicle_id", "characteristic");

-- AddForeignKey
ALTER TABLE "vehicle_characteristics" ADD CONSTRAINT "vehicle_characteristics_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
