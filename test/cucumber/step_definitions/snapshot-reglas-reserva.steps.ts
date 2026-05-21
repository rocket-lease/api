import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';
import { registerAndLogin, useAlias } from './auth';

const RENTADOR_ALIAS = '__rentador_snapshot__';
const CONDUCTOR_A_ALIAS = 'A';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVehicleId(world: MyWorld, plate: string): string {
  const id = world.world.vehicle_by_plate?.[plate];
  if (!id) throw new Error(`No hay vehículo con patente "${plate}"`);
  return id;
}

function getRuleSetId(world: MyWorld, name: string): string {
  const id = world.world['ruleset_by_name']?.[name];
  if (!id) throw new Error(`No hay rule set con nombre "${name}"`);
  return id;
}

function setRuleSetId(world: MyWorld, name: string, id: string): void {
  if (!world.world['ruleset_by_name']) world.world['ruleset_by_name'] = {};
  world.world['ruleset_by_name'][name] = id;
}

function getReservationId(world: MyWorld, alias: string): string {
  const id = world.world.reservations_by_alias?.[alias];
  if (!id) throw new Error(`No hay reserva para el conductor "${alias}"`);
  return id;
}

function setReservationId(world: MyWorld, alias: string, id: string): void {
  if (!world.world.reservations_by_alias) world.world.reservations_by_alias = {};
  world.world.reservations_by_alias[alias] = id;
}

async function ensureRentador(world: MyWorld): Promise<void> {
  if (!world.world.tokens_by_alias?.[RENTADOR_ALIAS]) {
    await registerAndLogin(world, RENTADOR_ALIAS);
  }
  useAlias(world, RENTADOR_ALIAS);
}

async function publishVehicle(
  world: MyWorld,
  plate: string,
  basePriceCents: number,
  autoAccept: boolean,
): Promise<string> {
  await ensureRentador(world);
  const res = await api(world).post('/vehicle', {
    plate,
    brand: 'Toyota',
    model: 'Corolla',
    year: 2023,
    passengers: 5,
    trunkLiters: 400,
    transmission: 'Manual',
    isAccessible: false,
    photos: ['https://example.com/photo1.jpg'],
    color: 'Rojo',
    mileage: 10000,
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
  return res.body.id;
}

/**
 * Conductor "A" crea y confirma una reserva (pago con credit_card).
 * El vehículo debe estar en auto-aceptación para que entre directamente a
 * `pending_payment` y el pago pueda confirmarse.
 */
async function conductorAConfirmsReservation(world: MyWorld, plate: string): Promise<string> {
  if (!world.world.tokens_by_alias?.[CONDUCTOR_A_ALIAS]) {
    await registerAndLogin(world, CONDUCTOR_A_ALIAS);
  }
  useAlias(world, CONDUCTOR_A_ALIAS);

  const vehicleId = getVehicleId(world, plate);
  const createRes = await api(world).post('/reservations', {
    vehicleId,
    startAt: '2026-07-01T10:00:00Z',
    endAt: '2026-07-05T10:00:00Z',
    contractAccepted: true,
  });
  expect(createRes.status).toBe(201);
  const reservationId = createRes.body.id;
  setReservationId(world, CONDUCTOR_A_ALIAS, reservationId);
  world.world.reservation_response = createRes;

  // Confirm payment so snapshot is taken
  const payRes = await api(world).post(`/reservations/${reservationId}/payment`, {
    paymentMethod: 'credit_card',
  });
  expect(payRes.status).toBe(200);
  world.world.reservation_response = payRes;

  return reservationId;
}

// ---------------------------------------------------------------------------
// GIVEN – vehicle setup
// ---------------------------------------------------------------------------

Given(
  'que soy rentador con un vehículo {string} en modo auto-aceptación',
  async function (this: MyWorld, plate: string) {
    await publishVehicle(this, plate, 2000000, true);
  },
);

Given(
  'que soy rentador con un vehículo {string} en modo auto-aceptación sin set asignado',
  async function (this: MyWorld, plate: string) {
    await publishVehicle(this, plate, 2000000, true);
    // No se asigna ningún rule set — el vehicle queda con reservationRuleSetId = null
  },
);

// ---------------------------------------------------------------------------
// GIVEN – rule set setup
// ---------------------------------------------------------------------------

Given(
  'el vehículo {string} usa un set {string} sin seña',
  async function (this: MyWorld, plate: string, setName: string) {
    await ensureRentador(this);
    const vehicleId = getVehicleId(this, plate);

    // Create the shared rule set without deposit
    const ruleSetRes = await api(this).post('/reservation-rules', {
      name: setName,
      cancellationPolicy: 'FLEXIBLE',
      depositPercentage: null,
      maxKilometrage: { type: 'UNLIMITED' },
      rentalTimeConstraints: { minDays: 1 },
      vehicleId: null,
    });
    expect(ruleSetRes.status).toBe(201);
    const ruleSetId = ruleSetRes.body.id;
    setRuleSetId(this, setName, ruleSetId);

    // Assign the rule set to the vehicle via PATCH /vehicle/:id
    const assignRes = await api(this).patch(`/vehicle/${vehicleId}`, {
      reservationRuleSetId: ruleSetId,
    });
    expect(assignRes.status).toBe(200);
  },
);

Given(
  'el vehículo {string} tiene basePriceCents = {int}',
  async function (this: MyWorld, plate: string, basePriceCents: number) {
    await ensureRentador(this);
    const vehicleId = getVehicleId(this, plate);

    const updateRes = await api(this).patch(`/vehicle/${vehicleId}`, { basePriceCents });
    expect(updateRes.status).toBe(200);
  },
);

// ---------------------------------------------------------------------------
// GIVEN – reservation already confirmed
// ---------------------------------------------------------------------------

Given(
  'el conductor {string} confirmó una reserva del vehículo {string}',
  async function (this: MyWorld, alias: string, plate: string) {
    // Only alias "A" is supported in this feature; keep generic for flexibility.
    if (alias !== CONDUCTOR_A_ALIAS) {
      // Ensure the conductor is registered under the given alias
      if (!this.world.tokens_by_alias?.[alias]) {
        await registerAndLogin(this, alias);
      }
    }
    await conductorAConfirmsReservation(this, plate);
  },
);

// ---------------------------------------------------------------------------
// WHEN
// ---------------------------------------------------------------------------

When(
  'el rentador cambia el set {string} a depositPercentage = {int}',
  async function (this: MyWorld, setName: string, depositPercentage: number) {
    await ensureRentador(this);
    const ruleSetId = getRuleSetId(this, setName);

    const res = await api(this).patch(`/reservation-rules/${ruleSetId}`, {
      depositPercentage,
    });
    expect(res.status).toBe(200);
  },
);

When(
  'el rentador cambia el precio del vehículo {string} a {int}',
  async function (this: MyWorld, plate: string, newPrice: number) {
    await ensureRentador(this);
    const vehicleId = getVehicleId(this, plate);

    const res = await api(this).patch(`/vehicle/${vehicleId}`, {
      basePriceCents: newPrice,
    });
    expect(res.status).toBe(200);
  },
);

When(
  'el conductor {string} confirma una reserva del vehículo {string}',
  async function (this: MyWorld, alias: string, plate: string) {
    if (alias !== CONDUCTOR_A_ALIAS) {
      if (!this.world.tokens_by_alias?.[alias]) {
        await registerAndLogin(this, alias);
      }
    }
    await conductorAConfirmsReservation(this, plate);
  },
);

// ---------------------------------------------------------------------------
// THEN – snapshot assertions
// ---------------------------------------------------------------------------

Then(
  'la reserva confirmada del conductor {string} conserva depositPercentageSnapshot vacío',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);

    const res = await api(this).get(`/reservations/${reservationId}`);
    expect(res.status).toBe(200);
    // "vacío" → null (sin seña)
    expect(res.body.depositPercentageSnapshot).toBeNull();
  },
);

Then(
  'la reserva confirmada del conductor {string} conserva basePriceCentsSnapshot = {int}',
  async function (this: MyWorld, alias: string, expectedPrice: number) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);

    const res = await api(this).get(`/reservations/${reservationId}`);
    expect(res.status).toBe(200);
    expect(res.body.basePriceCentsSnapshot).toBe(expectedPrice);
  },
);

Then(
  'la reserva queda con depositPercentageSnapshot vacío',
  async function (this: MyWorld) {
    useAlias(this, CONDUCTOR_A_ALIAS);
    const reservationId = getReservationId(this, CONDUCTOR_A_ALIAS);

    const res = await api(this).get(`/reservations/${reservationId}`);
    expect(res.status).toBe(200);
    expect(res.body.depositPercentageSnapshot).toBeNull();
  },
);

Then(
  'la reserva queda con cancellationPolicySnapshot = {string}',
  async function (this: MyWorld, expectedPolicy: string) {
    useAlias(this, CONDUCTOR_A_ALIAS);
    const reservationId = getReservationId(this, CONDUCTOR_A_ALIAS);

    const res = await api(this).get(`/reservations/${reservationId}`);
    expect(res.status).toBe(200);
    expect(res.body.cancellationPolicySnapshot).toBe(expectedPolicy);
  },
);

Then(
  'la reserva queda con maxKilometrageTypeSnapshot = {string}',
  async function (this: MyWorld, expectedType: string) {
    useAlias(this, CONDUCTOR_A_ALIAS);
    const reservationId = getReservationId(this, CONDUCTOR_A_ALIAS);

    const res = await api(this).get(`/reservations/${reservationId}`);
    expect(res.status).toBe(200);
    // The API exposes maxKilometrageSnapshot as a nested object { type, value? }
    expect(res.body.maxKilometrageSnapshot?.type).toBe(expectedType);
  },
);

Then(
  'la reserva queda con minRentalDaysSnapshot = {int}',
  async function (this: MyWorld, expectedDays: number) {
    useAlias(this, CONDUCTOR_A_ALIAS);
    const reservationId = getReservationId(this, CONDUCTOR_A_ALIAS);

    const res = await api(this).get(`/reservations/${reservationId}`);
    expect(res.status).toBe(200);
    // The API exposes rentalTimeConstraintsSnapshot as { minDays?, maxDays? }
    expect(res.body.rentalTimeConstraintsSnapshot?.minDays).toBe(expectedDays);
  },
);
