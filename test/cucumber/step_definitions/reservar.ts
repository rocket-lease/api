import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';
import { ReservationService } from '@/application/reservation.service';

async function registerAndLogin(
  world: MyWorld,
  alias: string,
): Promise<string> {
  const email = `conductor-${alias.toLowerCase()}-${Date.now()}-${Math.random()
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
  const token = loginRes.body.access_token;
  if (!world.world.tokens_by_alias) world.world.tokens_by_alias = {};
  world.world.tokens_by_alias[alias] = token;
  return token;
}

function useAlias(world: MyWorld, alias: string): void {
  const token = world.world.tokens_by_alias?.[alias];
  if (!token) throw new Error(`conductor ${alias} no autenticado`);
  world.world.access_token = token;
}

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



Given(
  'que soy un conductor {string} autenticado',
  async function (this: MyWorld, alias: string) {
    await registerAndLogin(this, alias);
    useAlias(this, alias);
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

When(
  'transcurren {int} minutos sin completar el pago',
  function (this: MyWorld, minutes: number) {
    this.clock.advanceMs(minutes * 60 * 1000);
  },
);

When(
  'el sistema ejecuta el job de expiración de reservas',
  async function (this: MyWorld) {
    const service = this.app.get(ReservationService);
    await service.expireOverdueHolds();
  },
);

Then(
  'la reserva queda en estado {string}',
  function (this: MyWorld, status: string) {
    expect(this.world.reservation_response.status).toBe(201);
    expect(this.world.reservation_response.body.status).toBe(status);
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
