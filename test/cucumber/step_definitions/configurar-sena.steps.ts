import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';
import { registerAndLogin, useAlias } from './auth';

const RENTADOR_ALIAS = '__rentador_us49__';

/**
 * Registra y autentica al rentador (alias fijo) si todavía no existe en este escenario.
 */
async function ensureRentador(world: MyWorld): Promise<void> {
  if (!world.world.tokens_by_alias?.[RENTADOR_ALIAS]) {
    await registerAndLogin(world, RENTADOR_ALIAS);
  }
  useAlias(world, RENTADOR_ALIAS);
}

/**
 * Construye el body mínimo para crear un set de reglas.
 * Cualquier campo no especificado recibe un valor válido por defecto.
 */
function buildRuleSetBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: overrides.name ?? 'DefaultSet',
    cancellationPolicy: 'FLEXIBLE',
    depositPercentage: null,
    maxKilometrage: { type: 'UNLIMITED' },
    rentalTimeConstraints: { minDays: 1 },
    vehicleId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Estado compartido entre steps (por escenario, guardado en this.world)
// ---------------------------------------------------------------------------

function getRuleSetId(world: MyWorld, name: string): string {
  const id = world.world['ruleset_by_name']?.[name];
  if (!id) throw new Error(`No hay rule set con nombre "${name}"`);
  return id;
}

function setRuleSetId(world: MyWorld, name: string, id: string): void {
  if (!world.world['ruleset_by_name']) world.world['ruleset_by_name'] = {};
  world.world['ruleset_by_name'][name] = id;
}

function getVehicleId(world: MyWorld, plate: string): string {
  const id = world.world.vehicle_by_plate?.[plate];
  if (!id) throw new Error(`No hay vehículo con patente "${plate}"`);
  return id;
}

// ---------------------------------------------------------------------------
// GIVEN
// ---------------------------------------------------------------------------

Given(
  'que soy rentador autenticado con un set {string} sin seña',
  async function (this: MyWorld, setName: string) {
    await ensureRentador(this);

    const res = await api(this).post('/reservation-rules', buildRuleSetBody({ name: setName }));
    expect(res.status).toBe(201);
    setRuleSetId(this, setName, res.body.id);
  },
);

Given(
  'que soy rentador con un vehículo {string}',
  async function (this: MyWorld, plate: string) {
    await ensureRentador(this);

    if (!this.world.vehicle_by_plate?.[plate]) {
      const res = await api(this).post('/vehicle', {
        plate,
        brand: 'BMW',
        model: 'Serie 3',
        year: 2023,
        passengers: 5,
        trunkLiters: 400,
        transmission: 'Automatico',
        isAccessible: false,
        photos: ['https://example.com/photo1.jpg'],
        color: 'Blanco',
        mileage: 10000,
        basePriceCents: 3000000,
        description: null,
        province: 'B',
        city: 'CABA',
        address: 'Av. Corrientes 1234',
        latitude: -34.6037,
        longitude: -58.3816,
        availableFrom: '2026-06-01',
      });
      expect(res.status).toBe(201);
      if (!this.world.vehicle_by_plate) this.world.vehicle_by_plate = {};
      this.world.vehicle_by_plate[plate] = res.body.id;
    }
  },
);

Given('que soy rentador autenticado', async function (this: MyWorld) {
  await ensureRentador(this);
});

Given(
  'un set privado {string} sobre el vehículo {string}',
  async function (this: MyWorld, setName: string, plate: string) {
    // El rentador debe estar autenticado (step anterior lo garantiza).
    useAlias(this, RENTADOR_ALIAS);
    const vehicleId = getVehicleId(this, plate);

    const res = await api(this).post(
      '/reservation-rules',
      buildRuleSetBody({ name: setName, vehicleId }),
    );
    expect(res.status).toBe(201);
    setRuleSetId(this, setName, res.body.id);
  },
);

// ---------------------------------------------------------------------------
// WHEN
// ---------------------------------------------------------------------------

When(
  'actualizo el set {string} con depositPercentage = {int}',
  async function (this: MyWorld, setName: string, depositPercentage: number) {
    useAlias(this, RENTADOR_ALIAS);
    const ruleSetId = getRuleSetId(this, setName);

    this.world.lastResponse = await api(this).patch(
      `/reservation-rules/${ruleSetId}`,
      { depositPercentage },
    );
  },
);

When(
  'creo un set {string} con vehicleId del vehículo {string} y depositPercentage = {int}',
  async function (this: MyWorld, setName: string, plate: string, depositPercentage: number) {
    useAlias(this, RENTADOR_ALIAS);
    const vehicleId = getVehicleId(this, plate);

    const res = await api(this).post(
      '/reservation-rules',
      buildRuleSetBody({ name: setName, vehicleId, depositPercentage }),
    );
    this.world.lastResponse = res;
    if (res.status === 201) {
      setRuleSetId(this, setName, res.body.id);
    }
  },
);

When(
  'intento crear un set {string} con depositPercentage = {int}',
  async function (this: MyWorld, setName: string, depositPercentage: number) {
    useAlias(this, RENTADOR_ALIAS);

    this.world.lastResponse = await api(this).post(
      '/reservation-rules',
      buildRuleSetBody({ name: setName, depositPercentage }),
    );
  },
);

When(
  'intento actualizar el set {string} con un vehicleId distinto',
  async function (this: MyWorld, setName: string) {
    useAlias(this, RENTADOR_ALIAS);
    const ruleSetId = getRuleSetId(this, setName);

    // Intentamos pasar un vehicleId arbitrario.
    // El UpdateReservationRuleSetRequest excluye vehicleId (inmutable post-creación),
    // por lo que el servidor debe responder 400 con RULESET_VEHICLE_ID_IMMUTABLE.
    this.world.lastResponse = await api(this).patch(
      `/reservation-rules/${ruleSetId}`,
      { vehicleId: '00000000-0000-0000-0000-000000000001' },
    );
  },
);

// ---------------------------------------------------------------------------
// THEN
// ---------------------------------------------------------------------------

Then(
  'el set {string} queda con depositPercentage {int}',
  async function (this: MyWorld, setName: string, expectedDeposit: number) {
    useAlias(this, RENTADOR_ALIAS);
    expect(this.world.lastResponse.status).toBe(200);

    const ruleSetId = getRuleSetId(this, setName);
    const res = await api(this).get(`/reservation-rules/${ruleSetId}`);
    expect(res.status).toBe(200);
    expect(res.body.depositPercentage).toBe(expectedDeposit);
  },
);

Then(
  'el set {string} queda con vehicleId apuntando al vehículo {string}',
  async function (this: MyWorld, setName: string, plate: string) {
    useAlias(this, RENTADOR_ALIAS);
    expect(this.world.lastResponse.status).toBe(201);

    const ruleSetId = getRuleSetId(this, setName);
    const vehicleId = getVehicleId(this, plate);

    const res = await api(this).get(`/reservation-rules/${ruleSetId}`);
    expect(res.status).toBe(200);
    expect(res.body.vehicleId).toBe(vehicleId);
  },
);

Then(
  'el set {string} no aparece al listar mis sets compartidos',
  async function (this: MyWorld, setName: string) {
    useAlias(this, RENTADOR_ALIAS);

    const ruleSetId = getRuleSetId(this, setName);
    const res = await api(this).get('/reservation-rules');
    expect(res.status).toBe(200);

    const ids: string[] = (res.body as Array<{ id: string }>).map((s) => s.id);
    expect(ids).not.toContain(ruleSetId);
  },
);

Then(
  'recibo 400 con code {string}',
  function (this: MyWorld, errorCode: string) {
    expect(this.world.lastResponse.status).toBe(400);
    expect(this.world.lastResponse.body.code).toBe(errorCode);
  },
);
