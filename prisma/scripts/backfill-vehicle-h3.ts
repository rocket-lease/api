import { PrismaClient } from '@prisma/client';
import { latLonToH3 } from '../../src/application/helpers/h3';

/**
 * Rellena `vehicles.h3_cell` para filas existentes a partir de lat/lon.
 * Idempotente: recalcula todas las filas con coordenadas. Correr una vez
 * tras aplicar la migración `20260607000000_us51_h3_perf` (local y prod).
 *
 *   pnpm ts-node prisma/scripts/backfill-vehicle-h3.ts
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { id: true, latitude: true, longitude: true },
    });
    let updated = 0;
    for (const vehicle of vehicles) {
      const h3Cell = latLonToH3(vehicle.latitude, vehicle.longitude);
      if (!h3Cell) continue;
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { h3Cell },
      });
      updated += 1;
    }
    console.log(`Backfilled h3_cell for ${updated}/${vehicles.length} vehicles`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
