import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';
import { registerAndLogin, useAlias } from './auth';

const RENTADOR_ALIAS = '__owner_us40__';
const RENTADOR_AJENO_ALIAS = '__owner_us40_other__';

async function ensureRentadorWithVehicle(
  world: MyWorld,
  plate: string,
  autoAccept: boolean,
): Promise<string> {
  if (world.world.vehicle_by_plate?.[plate]) {
    return world.world.vehicle_by_plate[plate];
  }
  if (!world.world.tokens_by_alias?.[RENTADOR_ALIAS]) {
    await registerAndLogin(world, RENTADOR_ALIAS);
  }
  useAlias(world, RENTADOR_ALIAS);
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
    basePrice: 24000,
    description: null,
    province: 'B',
    city: 'CABA',
    availableFrom: '2026-06-01',
    autoAccept,
  });
  expect(res.status).toBe(201);
  if (!world.world.vehicle_by_plate) world.world.vehicle_by_plate = {};
  world.world.vehicle_by_plate[plate] = res.body.id;
  return res.body.id;
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

async function createSolicitud(
  world: MyWorld,
  conductorAlias: string,
  plate: string,
  startAt: string,
  endAt: string,
): Promise<string> {
  const vehicleId = world.world.vehicle_by_plate?.[plate];
  if (!vehicleId) throw new Error(`vehículo ${plate} no creado`);
  if (!world.world.tokens_by_alias?.[conductorAlias]) {
    await registerAndLogin(world, conductorAlias);
  }
  useAlias(world, conductorAlias);
  const res = await api(world).post('/reservations', {
    vehicleId,
    startAt,
    endAt,
    contractAccepted: true,
  });
  expect(res.status).toBe(201);
  setReservationId(world, conductorAlias, res.body.id);
  world.world.reservation_response = res;
  return res.body.id;
}

Given(
  'un rentador con vehículo {string} en modo aprobación manual',
  async function (this: MyWorld, plate: string) {
    await ensureRentadorWithVehicle(this, plate, false);
  },
);

Given(
  'un rentador con vehículo {string} en modo auto-aceptación',
  async function (this: MyWorld, plate: string) {
    await ensureRentadorWithVehicle(this, plate, true);
  },
);

When(
  'el conductor {string} crea una reserva del vehículo {string} desde {string} hasta {string}',
  async function (
    this: MyWorld,
    alias: string,
    plate: string,
    startAt: string,
    endAt: string,
  ) {
    const vehicleId = this.world.vehicle_by_plate?.[plate];
    if (!vehicleId) throw new Error(`vehículo ${plate} no creado`);
    if (!this.world.tokens_by_alias?.[alias]) {
      await registerAndLogin(this, alias);
    }
    useAlias(this, alias);
    const res = await api(this).post('/reservations', {
      vehicleId,
      startAt,
      endAt,
      contractAccepted: true,
    });
    this.world.reservation_response = res;
    if (res.status === 201) {
      setReservationId(this, alias, res.body.id);
    }
  },
);

Then('la reserva queda en estado {string}', function (this: MyWorld, status: string) {
  expect(this.world.reservation_response.status).toBe(201);
  expect(this.world.reservation_response.body.status).toBe(status);
});

Then('la reserva tiene TTL de 24 horas', function (this: MyWorld) {
  const holdExpiresAt = this.world.reservation_response.body.holdExpiresAt;
  expect(typeof holdExpiresAt).toBe('string');
  const expected = this.clock.now().getTime() + 24 * 60 * 60 * 1000;
  const actual = new Date(holdExpiresAt).getTime();
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2_000);
});

Then(
  'la reserva aparece en el panel de solicitudes del rentador',
  async function (this: MyWorld) {
    useAlias(this, RENTADOR_ALIAS);
    const res = await api(this).get(
      '/reservations?role=owner&status=pending_approval',
    );
    expect(res.status).toBe(200);
    const items = res.body.items as Array<{ id: string; status: string }>;
    const ourId = this.world.reservation_response.body.id;
    expect(items.some((r) => r.id === ourId)).toBe(true);
  },
);

Given(
  'una solicitud {string} del conductor {string} sobre el vehículo {string} del {string} al {string}',
  async function (
    this: MyWorld,
    status: string,
    alias: string,
    plate: string,
    startAt: string,
    endAt: string,
  ) {
    expect(status).toBe('pending_approval');
    await createSolicitud(this, alias, plate, startAt, endAt);
  },
);

When('el rentador aprueba la solicitud', async function (this: MyWorld) {
  useAlias(this, RENTADOR_ALIAS);
  const id = this.world.reservation_response.body.id;
  const res = await api(this).post(`/reservations/${id}/approve`);
  this.world.reservation_response = res;
});

When(
  'el rentador aprueba la solicitud del conductor {string}',
  async function (this: MyWorld, alias: string) {
    useAlias(this, RENTADOR_ALIAS);
    const id = getReservationId(this, alias);
    const res = await api(this).post(`/reservations/${id}/approve`);
    this.world.reservation_response = res;
  },
);

When(
  'el rentador rechaza la solicitud con razón {string}',
  async function (this: MyWorld, reason: string) {
    useAlias(this, RENTADOR_ALIAS);
    const id = this.world.reservation_response.body.id;
    const res = await api(this).post(`/reservations/${id}/reject`, { reason });
    this.world.reservation_response = res;
  },
);

Then('la reserva pasa a {string}', async function (this: MyWorld, status: string) {
  expect(this.world.reservation_response.status).toBe(200);
  expect(this.world.reservation_response.body.status).toBe(status);
});

Then('el conductor tiene 10 minutos para pagar', function (this: MyWorld) {
  const holdExpiresAt = this.world.reservation_response.body.holdExpiresAt;
  expect(typeof holdExpiresAt).toBe('string');
  const expected = this.clock.now().getTime() + 10 * 60 * 1000;
  const actual = new Date(holdExpiresAt).getTime();
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2_000);
});

Then(
  'el detalle de la reserva expone la razón {string}',
  async function (this: MyWorld, reason: string) {
    const id = this.world.reservation_response.body.id;
    useAlias(this, RENTADOR_ALIAS);
    const res = await api(this).get(`/reservations/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe(reason);
  },
);

Then(
  'la reserva del conductor {string} tiene una razón de rechazo no vacía',
  async function (this: MyWorld, alias: string) {
    const id = getReservationId(this, alias);
    useAlias(this, RENTADOR_ALIAS);
    const res = await api(this).get(`/reservations/${id}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.rejectionReason).toBe('string');
    expect(res.body.rejectionReason.length).toBeGreaterThan(0);
  },
);

When(
  'transcurren {int} horas sin respuesta del rentador',
  function (this: MyWorld, hours: number) {
    this.clock.advanceMs(hours * 60 * 60 * 1000);
  },
);

When(
  'el conductor {string} retira la solicitud',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const id = getReservationId(this, alias);
    const res = await api(this).post(`/reservations/${id}/cancel`);
    this.world.reservation_response = res;
  },
);

When(
  'un rentador ajeno intenta aprobar la solicitud',
  async function (this: MyWorld) {
    if (!this.world.tokens_by_alias?.[RENTADOR_AJENO_ALIAS]) {
      await registerAndLogin(this, RENTADOR_AJENO_ALIAS);
    }
    useAlias(this, RENTADOR_AJENO_ALIAS);
    const id = this.world.reservation_response.body.id;
    const res = await api(this).post(`/reservations/${id}/approve`);
    this.world.reservation_response = res;
  },
);

Then('el sistema responde {int}', function (this: MyWorld, status: number) {
  expect(this.world.reservation_response.status).toBe(status);
});

Then(
  'el sistema responde {int} con código {string}',
  function (this: MyWorld, status: number, code: string) {
    expect(this.world.reservation_response.status).toBe(status);
    expect(this.world.reservation_response.body.code).toBe(code);
  },
);

Given('el rentador rechazó la solicitud', async function (this: MyWorld) {
  useAlias(this, RENTADOR_ALIAS);
  const id = this.world.reservation_response.body.id;
  const res = await api(this).post(`/reservations/${id}/reject`, {});
  expect(res.status).toBe(200);
  this.world.reservation_response = res;
});

When('el rentador intenta aprobar la solicitud nuevamente', async function (this: MyWorld) {
  useAlias(this, RENTADOR_ALIAS);
  const id = this.world.reservation_response.body.id;
  const res = await api(this).post(`/reservations/${id}/approve`);
  this.world.reservation_response = res;
});
