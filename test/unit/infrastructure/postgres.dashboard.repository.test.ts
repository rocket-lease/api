import { PostgresDashboardRepository } from '@/infrastructure/repository/postgres.dashboard.repository';
import type { PrismaService } from '@/infrastructure/database/prisma.service';
import { randomUUID } from 'crypto';

const rentadorId = randomUUID();
const vehicleA = randomUUID();
const vehicleB = randomUUID();

const MS_PER_DAY = 86_400_000;
// Rango de 10 días para facilitar la cuenta de ocupación.
const to = new Date('2026-06-11T00:00:00.000Z');
const from = new Date(to.getTime() - 10 * MS_PER_DAY); // 2026-06-01
// "ahora" dentro del rango: 2026-06-07 (cae en la reserva confirmada de B).
const now = new Date('2026-06-07T00:00:00.000Z');
const range = { from, to, now };

function vehicleRow(id: string, plate: string) {
  return {
    id,
    brand: 'Toyota',
    model: 'Corolla',
    plate,
    photos: [{ url: `https://img/${plate}.jpg` }],
  };
}

/** Crea un mock de PrismaService con vehículos y reservas predefinidos. */
function makePrisma(vehicles: unknown[], reservations: unknown[]) {
  return {
    vehicle: {
      findMany: jest.fn().mockResolvedValue(vehicles),
      findFirst: jest.fn().mockResolvedValue(vehicles[0] ?? null),
    },
    reservation: {
      findMany: jest.fn().mockResolvedValue(reservations),
    },
  } as unknown as PrismaService;
}

describe('PostgresDashboardRepository', () => {
  it('calcula ocupación, ingresos y tasa de cancelación por vehículo', async () => {
    // Vehículo A: una reserva completada de 2 días (ocupa 2 de 10 = 20%), $1000.
    // Vehículo B: una reserva cancelada (no ocupa, no ingresa) + una confirmada de 4 días.
    const reservations = [
      {
        vehicleId: vehicleA,
        status: 'completed',
        startAt: new Date('2026-06-02T00:00:00.000Z'),
        endAt: new Date('2026-06-04T00:00:00.000Z'),
        totalCents: 100000,
        paidAt: new Date('2026-06-02T00:00:00.000Z'),
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
      {
        vehicleId: vehicleB,
        status: 'cancelled',
        startAt: new Date('2026-06-03T00:00:00.000Z'),
        endAt: new Date('2026-06-05T00:00:00.000Z'),
        totalCents: 50000,
        paidAt: null,
        createdAt: new Date('2026-06-03T00:00:00.000Z'),
      },
      {
        vehicleId: vehicleB,
        status: 'confirmed',
        startAt: new Date('2026-06-05T00:00:00.000Z'),
        endAt: new Date('2026-06-09T00:00:00.000Z'),
        totalCents: 200000,
        paidAt: new Date('2026-06-05T00:00:00.000Z'),
        createdAt: new Date('2026-06-05T00:00:00.000Z'),
      },
    ];
    const prisma = makePrisma(
      [vehicleRow(vehicleA, 'AAA111'), vehicleRow(vehicleB, 'BBB222')],
      reservations,
    );
    const repo = new PostgresDashboardRepository(prisma);

    const summary = await repo.getSummary(rentadorId, range);

    expect(summary.totalVehicles).toBe(2);
    expect(summary.monthlyRevenueCents).toBe(300000); // 1000 + 2000

    const a = summary.vehicles.find((v) => v.vehicleId === vehicleA)!;
    const b = summary.vehicles.find((v) => v.vehicleId === vehicleB)!;

    expect(a.occupancyRatePercent).toBe(20); // 2 / 10 días
    expect(a.revenueCents).toBe(100000);
    expect(a.cancellationRatePercent).toBe(0);

    expect(b.occupancyRatePercent).toBe(40); // 4 / 10 días (cancelada no cuenta)
    expect(b.revenueCents).toBe(200000);
    expect(b.cancellationRatePercent).toBe(50); // 1 cancelada de 2 creadas

    // Flota: (2 + 4) días ocupados / (2 vehículos * 10 días) = 30%
    expect(summary.fleetOccupancyRatePercent).toBe(30);
    // Global: 1 cancelada de 3 creadas = 33.3%
    expect(summary.cancellationRatePercent).toBeCloseTo(33.3, 1);
    // Activas: solo la confirmed que solapa el rango.
    expect(summary.activeReservations).toBe(1);
  });

  it('marca lowOccupancy bajo el umbral y ordena topVehicles por reservas', async () => {
    const reservations = [
      {
        vehicleId: vehicleA,
        status: 'completed',
        startAt: new Date('2026-06-02T00:00:00.000Z'),
        endAt: new Date('2026-06-03T00:00:00.000Z'),
        totalCents: 100000,
        paidAt: new Date('2026-06-02T00:00:00.000Z'),
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    ];
    const prisma = makePrisma([vehicleRow(vehicleA, 'AAA111')], reservations);
    const repo = new PostgresDashboardRepository(prisma);

    const summary = await repo.getSummary(rentadorId, range);
    const a = summary.vehicles[0];

    expect(a.occupancyRatePercent).toBe(10); // 1 / 10
    expect(a.lowOccupancy).toBe(true); // < 30
    expect(summary.topVehicles[0].vehicleId).toBe(vehicleA);
  });

  it('getVehicleDetail retorna null cuando el vehículo no pertenece al rentador', async () => {
    const prisma = {
      vehicle: { findFirst: jest.fn().mockResolvedValue(null) },
      reservation: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const repo = new PostgresDashboardRepository(prisma);

    const result = await repo.getVehicleDetail(rentadorId, vehicleA, range);

    expect(result).toBeNull();
  });

  it('getVehicleDetail agrega ingresos y cancelaciones del vehículo', async () => {
    const reservations = [
      {
        vehicleId: vehicleA,
        status: 'completed',
        startAt: new Date('2026-06-02T00:00:00.000Z'),
        endAt: new Date('2026-06-04T00:00:00.000Z'),
        totalCents: 150000,
        paidAt: new Date('2026-06-02T00:00:00.000Z'),
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
      {
        vehicleId: vehicleA,
        status: 'cancelled',
        startAt: new Date('2026-06-06T00:00:00.000Z'),
        endAt: new Date('2026-06-07T00:00:00.000Z'),
        totalCents: 80000,
        paidAt: null,
        createdAt: new Date('2026-06-06T00:00:00.000Z'),
      },
    ];
    const prisma = makePrisma([vehicleRow(vehicleA, 'AAA111')], reservations);
    const repo = new PostgresDashboardRepository(prisma);

    const detail = await repo.getVehicleDetail(rentadorId, vehicleA, range);

    expect(detail).not.toBeNull();
    expect(detail!.vehicle.revenueCents).toBe(150000);
    expect(detail!.reservationCount).toBe(1); // solo la completed cuenta como alquiler
    expect(detail!.cancelledCount).toBe(1);
  });
});
