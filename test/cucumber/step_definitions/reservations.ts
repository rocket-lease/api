import { Given, When, Then, DataTable } from '@cucumber/cucumber';
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

// -- Step definitions for US-28: Ver y gestionar reservas (conductor) --

When('accedo a {string}', async function (this: MyWorld, section: string) {
  if (section === 'Mis reservas') {
    this.world.reservation_response = await api(this).get('/reservations/mine');
  } else {
    throw new Error(`unknown section: ${section}`);
  }
});

Then('veo {int} reservas listadas', function (this: MyWorld, count: number) {
  const items = this.world.reservation_response.body.items;
  expect(items).toHaveLength(count);
});

Then('la primera reserva muestra el estado {string}', function (this: MyWorld, status: string) {
  const first = this.world.reservation_response.body.items[0];
  expect(first.status).toBe(status);
});

Then('la primera reserva incluye fechas, vehículo e importe', function (this: MyWorld) {
  const first = this.world.reservation_response.body.items[0];
  expect(first.startAt).toBeDefined();
  expect(first.endAt).toBeDefined();
  expect(first.vehicle).toBeDefined();
  expect(first.vehicle.brand).toBeDefined();
  expect(first.vehicle.model).toBeDefined();
  expect(first.totalCents).toBeDefined();
  expect(first.currency).toBe('ARS');
});

Then('la lista de reservas está vacía', function (this: MyWorld) {
  const items = this.world.reservation_response.body.items;
  expect(items).toHaveLength(0);
});

Then('recibo un error de autenticación', function (this: MyWorld) {
  expect(this.world.reservation_response.status).toBe(401);
});

When(
  'accedo al detalle de la reserva del conductor {string}',
  async function (this: MyWorld, alias: string) {
    const reservationId = this.world.reservations_by_alias?.[alias];
    if (!reservationId) throw new Error(`no reservation found for alias ${alias}`);
    this.world.reservation_response = await api(this).get(`/reservations/${reservationId}`);
  },
);

Then('veo el estado {string}', function (this: MyWorld, status: string) {
  expect(this.world.reservation_response.body.status).toBe(status);
});

Then('veo la fecha de inicio {string} y fin {string}', function (this: MyWorld, startAt: string, endAt: string) {
  expect(this.world.reservation_response.body.startAt).toBe(startAt);
  expect(this.world.reservation_response.body.endAt).toBe(endAt);
});

Then('veo los datos del vehículo', function (this: MyWorld) {
  const dto = this.world.reservation_response.body;
  expect(dto.vehicle).toBeDefined();
  expect(dto.vehicle.brand).toBeDefined();
  expect(dto.vehicle.model).toBeDefined();
  expect(dto.vehicle.photo).toBeDefined();
});

Then('veo los datos del rentador', function (this: MyWorld) {
  const dto = this.world.reservation_response.body;
  expect(dto.rentador).toBeDefined();
  expect(dto.rentador.name).toBeDefined();
  expect(dto.rentador.avatarUrl).toBeDefined();
});

Then('veo el importe total', function (this: MyWorld) {
  const dto = this.world.reservation_response.body;
  expect(dto.totalCents).toBeDefined();
  expect(typeof dto.totalCents).toBe('number');
  expect(dto.totalCents).toBeGreaterThan(0);
  expect(dto.currency).toBe('ARS');
});

Then('veo que el contrato fue aceptado', function (this: MyWorld) {
  const dto = this.world.reservation_response.body;
  expect(dto.contractAcceptedAt).toBeDefined();
  expect(dto.contractAcceptedAt).not.toBeNull();
});

When(
  'cancelo la reserva del conductor {string}',
  async function (this: MyWorld, alias: string) {
    const reservationId = this.world.reservations_by_alias?.[alias];
    if (!reservationId) throw new Error(`no reservation found for alias ${alias}`);
    this.world.reservation_response = await api(this).post(`/reservations/${reservationId}/cancel`);
  },
);

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
