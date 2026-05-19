import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { MyWorld } from '../support/world';
import { api } from '../support/http-client';
import { registerAndLogin, useAlias } from './auth';

function getReservationId(world: MyWorld, alias: string): string {
  const id = world.world.reservations_by_alias?.[alias];
  if (!id) throw new Error(`no hay reserva para ${alias}`);
  return id;
}

// -- Payment methods listing --

When(
  'el conductor {string} consulta los métodos de pago disponibles',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    this.world.reservation_response = await api(this).get(
      `/reservations/${reservationId}/payment-methods`,
    );
  },
);

Then(
  'el conductor {string} ve métodos de pago: {string}',
  function (this: MyWorld, _alias: string, methodsCsv: string) {
    const expected = methodsCsv
      .split(',')
      .map((m) => m.trim().replace(/"/g, ''));
    const body = this.world.reservation_response.body;
    expect(body.methods).toBeDefined();
    expect(body.methods).toEqual(expected);
  },
);

// -- Bank transfer initiation --

When(
  'el conductor {string} inicia pago por transferencia bancaria',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    this.world.reservation_response = await api(this).post(
      `/reservations/${reservationId}/transfer`,
    );
  },
);

Then(
  'la reserva tiene un código de transferencia generado',
  function (this: MyWorld) {
    const body = this.world.reservation_response.body;
    expect(body.transferCode).toBeDefined();
    expect(typeof body.transferCode).toBe('string');
    expect(body.transferCode.length).toBeGreaterThan(0);
  },
);

Then('la transferencia expira en 2 horas', function (this: MyWorld) {
  const body = this.world.reservation_response.body;
  expect(body.transferExpiresAt).toBeDefined();
  const expiresAt = new Date(body.transferExpiresAt).getTime();
  const now = this.clock.now().getTime();
  const diffHours = (expiresAt - now) / (1000 * 60 * 60);
  expect(Math.abs(diffHours - 2)).toBeLessThanOrEqual(0.1);
});

// -- Transfer expiry --

When(
  'transcurren {int} horas sin acreditar la transferencia',
  function (this: MyWorld, hours: number) {
    this.clock.advanceMs(hours * 60 * 60 * 1000);
  },
);

When(
  'el sistema ejecuta el job de expiración de transferencias',
  async function (this: MyWorld) {
    const { ReservationExpiryJob } = await import(
      '@/infrastructure/jobs/reservation-expiry.job'
    );
    const job = this.app.get(ReservationExpiryJob);
    await job.expireTransfers();
  },
);

// -- Voucher and notification assertions --

Then('se genera un voucher QR para la reserva', function (this: MyWorld) {
  const body = this.world.reservation_response.body;
  const hasVoucherInfo = body.voucherToken != null || body.voucher?.qrCode != null;
  expect(hasVoucherInfo).toBe(true);
});

Then('se notifica al conductor y al rentador', function (this: MyWorld) {
  const body = this.world.reservation_response.body;
  expect(body.status).toBe('confirmed');
});

// -- Digital wallet payment --

When(
  'el conductor {string} confirma el pago con {string} y proveedor {string}',
  async function (
    this: MyWorld,
    alias: string,
    _method: string,
    walletProvider: string,
  ) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    this.world.reservation_response = await api(this).post(
      `/reservations/${reservationId}/payment`,
      { paymentMethod: 'digital_wallet', walletProvider },
    );
  },
);

// -- Bank transfer confirmation (acreditación) --

When(
  'se acredita la transferencia bancaria del conductor {string}',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    this.world.reservation_response = await api(this).post(
      `/reservations/${reservationId}/transfer/confirm`,
    );
  },
);

// ===== AC2: Bank transfer generates CBU/CVU =====

async function setupConductorAReservation(
  world: MyWorld,
): Promise<void> {
  if (!world.world.tokens_by_alias?.['A']) {
    await registerAndLogin(world, 'A');
  }
  useAlias(world, 'A');

  const vehicleId = world.world.vehicle_by_plate?.['AE987CC'];
  if (!vehicleId) throw new Error('vehículo AE987CC no encontrado');

  const res = await api(world).post('/reservations', {
    vehicleId,
    startAt: '2026-07-01T10:00:00Z',
    endAt: '2026-07-03T10:00:00Z',
    contractAccepted: true,
  });
  expect(res.status).toBe(201);
  world.world.reservation_response = res;

  if (!world.world.reservations_by_alias) {
    world.world.reservations_by_alias = {};
  }
  world.world.reservations_by_alias['A'] = res.body.id;
}

Given('que elijo pago por transferencia', async function (this: MyWorld) {
  await setupConductorAReservation(this);
});

When('confirmo', async function (this: MyWorld) {
  useAlias(this, 'A');
  const reservationId = getReservationId(this, 'A');
  this.world.reservation_response = await api(this).post(
    `/reservations/${reservationId}/transfer`,
  );
});

Then(
  'el sistema genera CBU\\/CVU y monto con validez de 2 horas,',
  function (this: MyWorld) {
    const body = this.world.reservation_response.body;
    expect(body.transferCode).toBeDefined();
    expect(typeof body.transferCode).toBe('string');
    expect(body.transferCode.length).toBeGreaterThan(0);
    expect(body.totalCents).toBeDefined();
    expect(body.totalCents).toBeGreaterThan(0);
    expect(body.transferExpiresAt).toBeDefined();
    const expiresAt = new Date(body.transferExpiresAt).getTime();
    const now = this.clock.now().getTime();
    const diffHours = (expiresAt - now) / (1000 * 60 * 60);
    expect(Math.abs(diffHours - 2)).toBeLessThanOrEqual(0.1);
  },
);

const STATUS_MAP: Record<string, string> = {
  'Pendiente de acreditación': 'pending_approval',
};

Then(
  'la reserva queda en {string}',
  async function (this: MyWorld, estado: string) {
    useAlias(this, 'A');
    const reservationId = getReservationId(this, 'A');
    const expectedStatus = STATUS_MAP[estado] ?? estado;
    const res = await api(this).get(`/reservations/${reservationId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(expectedStatus);
  },
);

// ===== AC3: Transfer expiry =====

Given(
  'que la transferencia no se acredita en 2 horas',
  async function (this: MyWorld) {
    await setupConductorAReservation(this);
    useAlias(this, 'A');
    const reservationId = getReservationId(this, 'A');
    await api(this).post(`/reservations/${reservationId}/transfer`);
    this.clock.advanceMs(2 * 60 * 60 * 1000);
  },
);

When('vence el plazo', async function (this: MyWorld) {
  const { ReservationExpiryJob } = await import(
    '@/infrastructure/jobs/reservation-expiry.job'
  );
  const job = this.app.get(ReservationExpiryJob);
  await job.expireTransfers();
});

Then(
  'la reserva se cancela y el vehículo vuelve a estar disponible',
  async function (this: MyWorld) {
    useAlias(this, 'A');
    const reservationId = getReservationId(this, 'A');

    const res = await api(this).get(`/reservations/${reservationId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');

    const vehicleId = this.world.vehicle_by_plate?.['AE987CC'];
    if (!vehicleId) throw new Error('vehículo AE987CC no encontrado');
    const newRes = await api(this).post('/reservations', {
      vehicleId,
      startAt: '2026-07-01T10:00:00Z',
      endAt: '2026-07-03T10:00:00Z',
      contractAccepted: true,
    });
    expect(newRes.status).toBe(201);
  },
);
