import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';
import { registerAndLogin, useAlias } from './auth';

interface BulkPriceWorld {
  bulk_vehicle_ids?: string[];
  other_owner_vehicle_id?: string;
  bulk_price_response?: any;
  bulk_count_response?: any;
}

function getBulkWorld(world: MyWorld): BulkPriceWorld {
  return world.world as unknown as BulkPriceWorld;
}

async function publishVehicle(world: MyWorld, basePriceCents: number): Promise<string> {
  const plate = `BP-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const res = await api(world).post('/vehicle', {
    plate,
    brand: 'Ford',
    model: 'Ranger',
    year: 2023,
    passengers: 5,
    trunkLiters: 400,
    transmission: 'Manual',
    isAccessible: false,
    photos: ['https://example.com/photo.jpg'],
    color: 'Blanco',
    mileage: 50000,
    basePriceCents,
    description: null,
    province: 'Buenos Aires',
    city: 'CABA',
    availableFrom: '2026-06-01',
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

Given(
  'que soy un rentador {string} autenticado',
  async function (this: MyWorld, alias: string) {
    await registerAndLogin(this, alias);
    useAlias(this, alias);
  },
);

Given(
  'que publiqué {int} vehículos con precio base {int} centavos',
  async function (this: MyWorld, count: number, basePriceCents: number) {
    const bw = getBulkWorld(this);
    bw.bulk_vehicle_ids = [];

    for (let i = 0; i < count; i++) {
      const id = await publishVehicle(this, basePriceCents);
      bw.bulk_vehicle_ids.push(id);
    }
  },
);

Given('que existe un vehículo de otro rentador', async function (this: MyWorld) {
  const bw = getBulkWorld(this);
  const savedToken = this.world.access_token;

  await registerAndLogin(this, '__other_owner__');
  useAlias(this, '__other_owner__');

  const id = await publishVehicle(this, 9999);
  bw.other_owner_vehicle_id = id;

  this.world.access_token = savedToken;
});

When(
  'aplico un ajuste de precio PERCENTAGE con delta {int} a esos vehículos',
  async function (this: MyWorld, delta: number) {
    const bw = getBulkWorld(this);
    const vehicleIds = bw.bulk_vehicle_ids ?? [];

    const res = await api(this).patch('/vehicle/bulk-prices', {
      vehicleIds,
      operation: { type: 'PERCENTAGE', delta },
    });

    bw.bulk_price_response = res;
  },
);

When(
  'aplico un ajuste de precio SET con valor {int} centavos a esos vehículos',
  async function (this: MyWorld, valueCents: number) {
    const bw = getBulkWorld(this);
    const vehicleIds = bw.bulk_vehicle_ids ?? [];

    const res = await api(this).patch('/vehicle/bulk-prices', {
      vehicleIds,
      operation: { type: 'SET', valueCents },
    });

    bw.bulk_price_response = res;
  },
);

When(
  'aplico un ajuste de precio SET con valor {int} centavos incluyendo el vehículo ajeno',
  async function (this: MyWorld, valueCents: number) {
    const bw = getBulkWorld(this);
    const myIds = bw.bulk_vehicle_ids ?? [];
    const otherId = bw.other_owner_vehicle_id;
    if (!otherId) throw new Error('vehículo ajeno no inicializado');

    const vehicleIds = [...myIds, otherId];

    const res = await api(this).patch('/vehicle/bulk-prices', {
      vehicleIds,
      operation: { type: 'SET', valueCents },
    });

    bw.bulk_price_response = res;
  },
);

When(
  'consulto el conteo de reservas activas de esos vehículos',
  async function (this: MyWorld) {
    const bw = getBulkWorld(this);
    const vehicleIds = bw.bulk_vehicle_ids ?? [];

    const res = await api(this).post('/vehicle/active-reservations-count', { vehicleIds });
    bw.bulk_count_response = res;
  },
);

Then('la respuesta es exitosa', function (this: MyWorld) {
  const bw = getBulkWorld(this);
  const res = bw.bulk_price_response ?? bw.bulk_count_response;
  if (!res) throw new Error('no hay respuesta capturada');
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
});

Then(
  'los {int} vehículos tienen el nuevo precio {int} centavos',
  function (this: MyWorld, count: number, expectedPrice: number) {
    const bw = getBulkWorld(this);
    const res = bw.bulk_price_response;
    expect(res.body.updated).toHaveLength(count);
    for (const item of res.body.updated) {
      expect(item.newPriceCents).toBe(expectedPrice);
    }
  },
);

Then(
  'el sistema responde con error {int}',
  function (this: MyWorld, statusCode: number) {
    const bw = getBulkWorld(this);
    const res = bw.bulk_price_response ?? bw.bulk_count_response;
    if (!res) throw new Error('no hay respuesta capturada');
    expect(res.status).toBe(statusCode);
  },
);

Then(
  'el código de error es {string}',
  function (this: MyWorld, errorCode: string) {
    const bw = getBulkWorld(this);
    const res = bw.bulk_price_response ?? bw.bulk_count_response;
    if (!res) throw new Error('no hay respuesta capturada');
    expect(res.body.code).toBe(errorCode);
  },
);

Then(
  'el conteo incluye los {int} vehículos',
  function (this: MyWorld, count: number) {
    const bw = getBulkWorld(this);
    const res = bw.bulk_count_response;
    expect(res.body.counts).toBeDefined();
    expect(Object.keys(res.body.counts)).toHaveLength(count);
  },
);
