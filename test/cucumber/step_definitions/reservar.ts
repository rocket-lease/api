import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';
import { registerAndLogin, useAlias } from './auth';

function getReservationId(world: MyWorld, alias: string): string {
  const id = world.world.reservations_by_alias?.[alias];
  if (!id) throw new Error(`no hay reserva para ${alias}`);
  return id;
}

function setReservationId(world: MyWorld, alias: string, id: string): void {
  if (!world.world.reservations_by_alias) {
    world.world.reservations_by_alias = {};
  }
  world.world.reservations_by_alias[alias] = id;
}

async function ensureVehiclePublished(
  world: MyWorld,
  plate: string,
  basePriceCents: number,
  autoAccept: boolean | null = null,
): Promise<string> {
  if (world.world.vehicle_by_plate?.[plate]) {
    return world.world.vehicle_by_plate[plate];
  }
  await registerAndLogin(world, '__owner__');
  useAlias(world, '__owner__');
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
    availableFrom: '2026-06-01',
    autoAccept,
  });
  expect(res.status).toBe(201);
  if (!world.world.vehicle_by_plate) world.world.vehicle_by_plate = {};
  world.world.vehicle_by_plate[plate] = res.body.id;
  world.world.access_token = undefined;
  return res.body.id;
}

Given(
  'que existe un vehículo publicado con patente {string} y precio base {int}',
  async function (this: MyWorld, plate: string, basePriceCents: number) {
    await ensureVehiclePublished(this, plate, basePriceCents);
  },
);

Given(
  'que existe un vehículo publicado con patente {string}, precio base {int} y auto-aceptación activada',
  async function (this: MyWorld, plate: string, basePriceCents: number) {
    await ensureVehiclePublished(this, plate, basePriceCents, true);
  },
);


Given('firmo el contrato digital', function (this: MyWorld) {
  this.world.profile_payload = { contract_accepted: true };
});

When(
  'creo una reserva del vehículo {string} desde {string} hasta {string}',
  async function (
    this: MyWorld,
    plate: string,
    startAt: string,
    endAt: string,
  ) {
    const vehicleId = this.world.vehicle_by_plate?.[plate];
    if (!vehicleId) throw new Error(`vehículo ${plate} no creado`);
    const contractAccepted =
      this.world.profile_payload?.contract_accepted === true;
    this.world.reservation_response = await api(this).post('/reservations', {
      vehicleId,
      startAt,
      endAt,
      contractAccepted,
    });
    if (this.world.reservation_response.status === 201) {
      // first-created alias defaults to "A" if not set
      const alias = 'A';
      setReservationId(this, alias, this.world.reservation_response.body.id);
    }
  },
);

When(
  'creo una reserva del vehículo {string} desde {string} hasta {string} sin firmar el contrato',
  async function (
    this: MyWorld,
    plate: string,
    startAt: string,
    endAt: string,
  ) {
    const vehicleId = this.world.vehicle_by_plate?.[plate];
    if (!vehicleId) throw new Error(`vehículo ${plate} no creado`);
    this.world.reservation_response = await api(this).post('/reservations', {
      vehicleId,
      startAt,
      endAt,
      contractAccepted: false,
    });
  },
);

Given(
  'que el conductor {string} reservó el vehículo {string} desde {string} hasta {string} firmando el contrato',
  async function (
    this: MyWorld,
    alias: string,
    plate: string,
    startAt: string,
    endAt: string,
  ) {
    if (!this.world.tokens_by_alias?.[alias]) {
      await registerAndLogin(this, alias);
    }
    useAlias(this, alias);
    const vehicleId = this.world.vehicle_by_plate?.[plate];
    if (!vehicleId) throw new Error(`vehículo ${plate} no creado`);
    const res = await api(this).post('/reservations', {
      vehicleId,
      startAt,
      endAt,
      contractAccepted: true,
    });
    expect(res.status).toBe(201);
    setReservationId(this, alias, res.body.id);
    this.world.reservation_response = res;
  },
);

When(
  'el conductor {string} intenta reservar el vehículo {string} desde {string} hasta {string} firmando el contrato',
  async function (
    this: MyWorld,
    alias: string,
    plate: string,
    startAt: string,
    endAt: string,
  ) {
    if (!this.world.tokens_by_alias?.[alias]) {
      await registerAndLogin(this, alias);
    }
    useAlias(this, alias);
    const vehicleId = this.world.vehicle_by_plate?.[plate];
    if (!vehicleId) throw new Error(`vehículo ${plate} no creado`);
    this.world.reservation_response = await api(this).post('/reservations', {
      vehicleId,
      startAt,
      endAt,
      contractAccepted: true,
    });
    if (this.world.reservation_response.status === 201) {
      setReservationId(this, alias, this.world.reservation_response.body.id);
    }
  },
);

When(
  'el conductor {string} confirma el pago con {string}',
  async function (this: MyWorld, alias: string, paymentMethod: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    this.world.reservation_response = await api(this).post(
      `/reservations/${reservationId}/payment`,
      { paymentMethod },
    );
  },
);

Then(
  'la reserva tiene una fecha de expiración a {int} minutos',
  function (this: MyWorld, minutes: number) {
    const holdExpiresAt =
      this.world.reservation_response.body.holdExpiresAt;
    expect(typeof holdExpiresAt).toBe('string');
    const expected = this.clock.now().getTime() + minutes * 60 * 1000;
    const actual = new Date(holdExpiresAt).getTime();
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2_000);
  },
);

Then(
  'el conductor {string} recibe el código de error {string}',
  function (this: MyWorld, _alias: string, code: string) {
    const status = this.world.reservation_response.status;
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
    expect(this.world.reservation_response.body.code).toBe(code);
  },
);

Then(
  'la reserva del conductor {string} queda en estado {string}',
  async function (this: MyWorld, alias: string, status: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    const res = await api(this).get(`/reservations/${reservationId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(status);
  },
);

Then(
  'el conductor {string} puede reservar el vehículo {string} desde {string} hasta {string} firmando el contrato',
  async function (
    this: MyWorld,
    alias: string,
    plate: string,
    startAt: string,
    endAt: string,
  ) {
    if (!this.world.tokens_by_alias?.[alias]) {
      await registerAndLogin(this, alias);
    }
    useAlias(this, alias);
    const vehicleId = this.world.vehicle_by_plate?.[plate];
    if (!vehicleId) throw new Error(`vehículo ${plate} no creado`);
    const res = await api(this).post('/reservations', {
      vehicleId,
      startAt,
      endAt,
      contractAccepted: true,
    });
    expect(res.status).toBe(201);
    setReservationId(this, alias, res.body.id);
  },
);
