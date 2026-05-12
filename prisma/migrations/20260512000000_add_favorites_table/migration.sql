-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "conductor_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorites_conductor_id_vehicle_id_key" ON "favorites"("conductor_id", "vehicle_id");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_conductor_id_fkey" FOREIGN KEY ("conductor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
