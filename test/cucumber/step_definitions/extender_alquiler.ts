import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';
import { registerAndLoginVerified, useAlias } from './auth';

const OWNER_ALIAS = '__owner_extender__';

/**
 * Crea un rentador con un vehículo verificado para los escenarios de
 * extensión. Se reusa entre escenarios si la patente ya fue dada de alta.
 */
async function ensureVehicleForExtension(
  world: MyWorld,
  plate: string,
  basePriceCents: number,
  autoAccept: boolean,
): Promise<string> {
  if (world.world.vehicle_by_plate?.[plate]) {
    return world.world.vehicle_by_plate[plate];
  }
  if (!world.world.tokens_by_alias?.[OWNER_ALIAS]) {
    await registerAndLoginVerified(world, OWNER_ALIAS);
  }
  useAlias(world, OWNER_ALIAS);
  const res = await api(world).post('/vehicle', {
    plate,
    brand: 'Ford',
    model: 'Ranger',
    year: 2023,
    passengers: 5,
    trunkLiters: 400,
    transmission: 'Manual',
    isAccessible: false,
    photos: ['https://example.com/photo1.jpg'],
    color: 'Azul',
    mileage: 50000,
    basePriceCents,
    description: null,
    province: 'B',
    city: 'CABA',
    address: 'Av. Corrientes 1000, CABA',
    latitude: -34.6037,
    longitude: -58.3816,
    availableFrom: '2026-06-01',
    autoAccept,
  });
  expect(res.status).toBe(201);
  if (!world.world.vehicle_by_plate) world.world.vehicle_by_plate = {};
  world.world.vehicle_by_plate[plate] = res.body.id;

  const vehicleId = res.body.id;
  const dummyBuffer = Buffer.from('/9j/4AAQ...', 'base64');
  const docsRes = await api(world).uploadFields(
    `/vehicle/${vehicleId}/documents`,
    [
      { fieldName: 'title', buffer: dummyBuffer, filename: 'title.jpg' },
      { fieldName: 'greenCard', buffer: dummyBuffer, filename: 'green-card.jpg' },
    ],
  );
  expect(docsRes.status).toBe(201);
  world.clock.advanceMs(60_000);
  const processRes = await api(world).post('/vehicle/documents/process');
  expect(processRes.status).toBe(200);

  return vehicleId;
}

/**
 * Avanza la reserva hasta `confirmed`. El conductor crea, paga y queda con
 * voucher. No la pasa a `in_progress` — eso lo hace `bringToInProgress`.
 */
async function createConfirmedReservation(
  world: MyWorld,
  conductorAlias: string,
  plate: string,
  startAt: string,
  endAt: string,
): Promise<string> {
  if (!world.world.tokens_by_alias?.[conductorAlias]) {
    await registerAndLoginVerified(world, conductorAlias);
  }
  const vehicleId = world.world.vehicle_by_plate?.[plate];
  if (!vehicleId) throw new Error(`vehículo ${plate} no creado`);
  useAlias(world, conductorAlias);
  const createRes = await api(world).post('/reservations', {
    vehicleId,
    startAt,
    endAt,
    contractAccepted: true,
  });
  expect(createRes.status).toBe(201);
  const reservationId = createRes.body.id as string;

  if (createRes.body.status === 'pending_approval') {
    useAlias(world, OWNER_ALIAS);
    const approveRes = await api(world).post(
      `/reservations/${reservationId}/approve`,
    );
    expect(approveRes.status).toBe(200);
    useAlias(world, conductorAlias);
  }

  const payRes = await api(world).post(
    `/reservations/${reservationId}/payment`,
    { paymentMethod: 'credit_card' },
  );
  expect(payRes.status).toBe(200);
  if (!world.world.reservations_by_alias) {
    world.world.reservations_by_alias = {};
  }
  world.world.reservations_by_alias[conductorAlias] = reservationId;
  return reservationId;
}

/**
 * Lleva una reserva confirmada a `in_progress` simulando el escaneo del QR
 * por parte del rentador en el momento del pickup. El voucherToken se lee del
 * detalle (con el conductor autenticado), luego se cambia al rentador para
 * hacer el POST `/reservations/pickup`.
 */
async function bringToInProgress(
  world: MyWorld,
  conductorAlias: string,
  reservationId: string,
): Promise<void> {
  useAlias(world, conductorAlias);
  const detail = await api(world).get(`/reservations/${reservationId}`);
  expect(detail.status).toBe(200);
  const voucherToken = detail.body.voucherToken as string;
  expect(typeof voucherToken).toBe('string');
  useAlias(world, OWNER_ALIAS);
  const pickup = await api(world).post('/reservations/pickup', { voucherToken });
  expect(pickup.status).toBe(200);
  useAlias(world, conductorAlias);
}

Given(
  'un rentador con vehículo {string} en auto-aceptación para extensiones con precio {int}',
  async function (this: MyWorld, plate: string, price: number) {
    await ensureVehicleForExtension(this, plate, price, true);
  },
);

Given(
  'un rentador con vehículo {string} en aprobación manual para extensiones con precio {int}',
  async function (this: MyWorld, plate: string, price: number) {
    await ensureVehicleForExtension(this, plate, price, false);
  },
);

Given(
  'el conductor {string} tiene un alquiler en curso del vehículo {string} del {string} al {string}',
  async function (
    this: MyWorld,
    alias: string,
    plate: string,
    startAt: string,
    endAt: string,
  ) {
    const id = await createConfirmedReservation(this, alias, plate, startAt, endAt);
    await bringToInProgress(this, alias, id);
  },
);

Given(
  'el conductor {string} tiene una reserva confirmada del vehículo {string} del {string} al {string}',
  async function (
    this: MyWorld,
    alias: string,
    plate: string,
    startAt: string,
    endAt: string,
  ) {
    await createConfirmedReservation(this, alias, plate, startAt, endAt);
  },
);

Given(
  'el conductor {string} extendió su alquiler hasta {string}',
  async function (this: MyWorld, alias: string, newEndAt: string) {
    useAlias(this, alias);
    const parentId = this.world.reservations_by_alias?.[alias];
    if (!parentId) throw new Error(`no hay reserva para ${alias}`);
    const res = await api(this).post(`/reservations/${parentId}/extend`, {
      newEndAt,
    });
    expect(res.status).toBe(201);
    if (!this.world.extensions_by_alias) {
      this.world.extensions_by_alias = {};
    }
    this.world.extensions_by_alias[alias] = res.body.id;
  },
);

When(
  'el conductor {string} solicita extender su alquiler hasta {string}',
  async function (this: MyWorld, alias: string, newEndAt: string) {
    useAlias(this, alias);
    const parentId = this.world.reservations_by_alias?.[alias];
    if (!parentId) throw new Error(`no hay reserva para ${alias}`);
    this.world.reservation_response = await api(this).post(
      `/reservations/${parentId}/extend`,
      { newEndAt },
    );
  },
);

When(
  'el conductor {string} intenta extender el alquiler del conductor {string} hasta {string}',
  async function (
    this: MyWorld,
    intruderAlias: string,
    victimAlias: string,
    newEndAt: string,
  ) {
    if (!this.world.tokens_by_alias?.[intruderAlias]) {
      await registerAndLoginVerified(this, intruderAlias);
    }
    useAlias(this, intruderAlias);
    const parentId = this.world.reservations_by_alias?.[victimAlias];
    if (!parentId) throw new Error(`no hay reserva para ${victimAlias}`);
    this.world.reservation_response = await api(this).post(
      `/reservations/${parentId}/extend`,
      { newEndAt },
    );
  },
);

When(
  'el conductor {string} cancela su alquiler',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const id = this.world.reservations_by_alias?.[alias];
    if (!id) throw new Error(`no hay reserva para ${alias}`);
    this.world.reservation_response = await api(this).post(
      `/reservations/${id}/cancel`,
    );
    expect(this.world.reservation_response.status).toBe(200);
  },
);

When(
  'el conductor {string} consulta el detalle de su reserva',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const id = this.world.reservations_by_alias?.[alias];
    if (!id) throw new Error(`no hay reserva para ${alias}`);
    this.world.reservation_response = await api(this).get(
      `/reservations/${id}`,
    );
    expect(this.world.reservation_response.status).toBe(200);
  },
);

Then(
  'la respuesta de extensión tiene requiresApproval={word}',
  function (this: MyWorld, value: string) {
    expect(this.world.reservation_response.status).toBe(201);
    expect(this.world.reservation_response.body.requiresApproval).toBe(
      value === 'true',
    );
  },
);

Then(
  'la respuesta de extensión tiene status {string}',
  function (this: MyWorld, status: string) {
    expect(this.world.reservation_response.body.status).toBe(status);
  },
);

Then(
  'la nueva reserva tiene parentReservationId apuntando a la reserva original del conductor {string}',
  function (this: MyWorld, alias: string) {
    const parentId = this.world.reservations_by_alias?.[alias];
    expect(parentId).toBeDefined();
    expect(this.world.reservation_response.body.parentReservationId).toBe(parentId);
  },
);

Then(
  'la respuesta de extensión es {int} con código {string}',
  function (this: MyWorld, status: number, code: string) {
    expect(this.world.reservation_response.status).toBe(status);
    expect(this.world.reservation_response.body.code).toBe(code);
  },
);

Then(
  'la respuesta de extensión es {int}',
  function (this: MyWorld, status: number) {
    expect(this.world.reservation_response.status).toBe(status);
  },
);

Then(
  'la reserva original del conductor {string} queda en estado {string}',
  async function (this: MyWorld, alias: string, status: string) {
    useAlias(this, alias);
    const id = this.world.reservations_by_alias?.[alias];
    if (!id) throw new Error(`no hay reserva para ${alias}`);
    const res = await api(this).get(`/reservations/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(status);
  },
);

Then(
  'la extensión del conductor {string} queda en estado {string}',
  async function (this: MyWorld, alias: string, status: string) {
    useAlias(this, alias);
    const id = this.world.extensions_by_alias?.[alias];
    if (!id) throw new Error(`no hay extensión para ${alias}`);
    const res = await api(this).get(`/reservations/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(status);
  },
);

Then(
  'el detalle incluye un chain con {int} eslabones',
  function (this: MyWorld, count: number) {
    const chain = this.world.reservation_response.body.chain;
    expect(Array.isArray(chain)).toBe(true);
    expect(chain.length).toBe(count);
  },
);
