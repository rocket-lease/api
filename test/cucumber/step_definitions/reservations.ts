import { Given, Then, DataTable } from '@cucumber/cucumber';
import { expect } from 'expect';
import { MyWorld } from '../support/world';
import { api } from '../support/http-client';
import { ReservationService } from '@/application/reservation.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';

interface PreMadeReservation {
  alias: string;
  status: 'pending_payment' | 'confirmed';
  startAt: string;
  endAt: string;
}

function mapReservationRow(rawData: any): PreMadeReservation {
  return {
    alias: rawData['alias'] ?? rawData['conductor'] ?? 'X',
    status: (rawData['estado'] ?? 'pending_payment') as
      | 'pending_payment'
      | 'confirmed',
    startAt: rawData['desde'] ?? '2026-07-01T10:00:00Z',
    endAt: rawData['hasta'] ?? '2026-07-03T10:00:00Z',
  };
}

async function registerConductor(world: MyWorld, alias: string): Promise<void> {
  if (world.world.tokens_by_alias?.[alias]) return;
  const email = `cancel-${alias}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`;
  const password = 'Passw0rd!';
  await api(world).post('/auth/register', {
    name: `Conductor ${alias}`,
    email,
    dni: '12345678',
    phone: '1123456789',
    password,
  });
  const loginRes = await api(world).post('/auth/login', { email, password });
  if (!world.world.tokens_by_alias) world.world.tokens_by_alias = {};
  world.world.tokens_by_alias[alias] = loginRes.body.access_token;
}

Given(
  'el vehículo tiene las siguientes reservas:',
  async function (this: MyWorld, dataTable: DataTable) {
    const rows = dataTable.hashes().map(mapReservationRow);
    const vehicleId = this.world.create_vehicle_response.body.id;
    const ownerToken = this.world.access_token;
    const reservationService = this.app.get(ReservationService);

    for (const row of rows) {
      await registerConductor(this, row.alias);
      this.world.access_token = this.world.tokens_by_alias![row.alias];
      const createRes = await api(this).post('/reservations', {
        vehicleId,
        startAt: row.startAt,
        endAt: row.endAt,
        contractAccepted: true,
      });
      expect(createRes.status).toBe(201);
      const reservationId = createRes.body.id;
      if (!this.world.reservations_by_alias) {
        this.world.reservations_by_alias = {};
      }
      this.world.reservations_by_alias[row.alias] = reservationId;

      if (row.status === 'confirmed') {
        const payRes = await api(this).post(
          `/reservations/${reservationId}/payment`,
          { paymentMethod: 'credit_card' },
        );
        expect(payRes.status).toBe(201);
      }

      if (!this.world.pre_made_reservations) {
        this.world.pre_made_reservations = [];
      }
      this.world.pre_made_reservations.push({
        alias: row.alias,
        status: row.status,
      });
    }

    // Restore owner token for the next vehicle steps.
    this.world.access_token = ownerToken;
    // touch reservationService so the import is not pruned
    void reservationService;
  },
);

Then('el sistema cancela las reservas', async function (this: MyWorld) {
  const prisma = this.app.get(PrismaService);
  const vehicleId = this.world.create_vehicle_response.body.id;
  const reservations = await prisma.reservation.findMany({
    where: { vehicleId },
  });
  const pendingBefore =
    this.world.pre_made_reservations?.filter(
      (r) => r.status === 'pending_payment',
    ) ?? [];
  for (const pre of pendingBefore) {
    const reservationId = this.world.reservations_by_alias![pre.alias];
    const row = reservations.find((r) => r.id === reservationId);
    expect(row).toBeDefined();
    expect(row!.status).toBe('cancelled');
  }
});

Then('no afecta reservas ya confirmadas', async function (this: MyWorld) {
  const prisma = this.app.get(PrismaService);
  const vehicleId = this.world.create_vehicle_response.body.id;
  const reservations = await prisma.reservation.findMany({
    where: { vehicleId },
  });
  const confirmedBefore =
    this.world.pre_made_reservations?.filter((r) => r.status === 'confirmed') ??
    [];
  for (const pre of confirmedBefore) {
    const reservationId = this.world.reservations_by_alias![pre.alias];
    const row = reservations.find((r) => r.id === reservationId);
    expect(row).toBeDefined();
    expect(row!.status).toBe('confirmed');
  }
});
