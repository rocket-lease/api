import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from 'expect';
import { MyWorld } from '../support/world';
import { api } from '../support/http-client';

function getVehicleId(world: MyWorld): string {
  const ctx = world.world as any;
  if (ctx.vehicle_by_plate) {
    const plates = Object.keys(ctx.vehicle_by_plate);
    if (plates.length > 0) {
      return ctx.vehicle_by_plate[plates[0]];
    }
  }
  if (ctx.create_vehicle_response?.body?.id) {
    return ctx.create_vehicle_response.body.id;
  }
  throw new Error(
    'No hay vehículo creado. Asegurate de que el Background haya corrido ' +
      '(Dado que estoy autenticado / un vehículo con los siguientes datos / ' +
      'el vehículo ya está publicado).',
  );
}

function parseDurationDays(durationStr: string): number {
  const match = durationStr.match(/^(\d+)\s*día/);
  if (!match) {
    throw new Error(`No se pudo extraer la cantidad de días de "${durationStr}"`);
  }
  return parseInt(match[1], 10);
}

Given('que el vehículo está promocionado', async function (this: MyWorld) {
  const ctx = this.world as any;
  const vehicleId = getVehicleId(this);

  const dursRes = await api(this).get('/promotion/durations');
  expect(dursRes.status).toBe(200);
  ctx.promotion_durations = dursRes.body;

  const dur = ctx.promotion_durations[0];
  ctx.promotion_current_days = dur.days;

  const promoteRes = await api(this).post(`/vehicle/${vehicleId}/promotion`, {
    durationDays: dur.days,
    startDate: new Date().toISOString(),
    paymentMethod: 'credit_card',
  });
  expect(promoteRes.status).toBe(201);
  ctx.promotion_response = promoteRes;
});

Given(
  'que el vehículo estuvo promocionado y la promoción expiró',
  async function (this: MyWorld) {
    const ctx = this.world as any;
    const vehicleId = getVehicleId(this);

    const dursRes = await api(this).get('/promotion/durations');
    expect(dursRes.status).toBe(200);
    ctx.promotion_durations = dursRes.body;

    const dur = ctx.promotion_durations[0];
    ctx.promotion_current_days = dur.days;

    const promoteRes = await api(this).post(`/vehicle/${vehicleId}/promotion`, {
      durationDays: dur.days,
      startDate: new Date().toISOString(),
      paymentMethod: 'credit_card',
    });
    expect(promoteRes.status).toBe(201);

    this.clock.advanceMs(dur.days * 24 * 60 * 60 * 1000 + 1000);

    const { PromotionExpiryJob } = await import(
      '@/infrastructure/jobs/promotion-expiry.job'
    );
    const job = this.app.get(PromotionExpiryJob);
    await job.expirePromotions();
  },
);

When(
  'accedo a las opciones de promoción del vehículo',
  async function (this: MyWorld) {
    const ctx = this.world as any;

    const dursRes = await api(this).get('/promotion/durations');
    ctx.promotion_durations_response = dursRes;
    ctx.promotion_durations = dursRes.body;
    expect(dursRes.status).toBe(200);
  },
);

When(
  'confirmo la promoción del vehículo por {string}',
  async function (this: MyWorld, duration: string) {
    const ctx = this.world as any;
    const vehicleId = getVehicleId(this);
    const days = parseDurationDays(duration);

    ctx.promotion_current_days = days;

    const res = await api(this).post(`/vehicle/${vehicleId}/promotion`, {
      durationDays: days,
      startDate: new Date().toISOString(),
      paymentMethod: 'credit_card',
    });
    ctx.promotion_response = res;
  },
);

When('transcurre el tiempo de promoción', function (this: MyWorld) {
  const ctx = this.world as any;
  const days = ctx.promotion_current_days;
  if (days == null) {
    throw new Error(
      'No hay información de duración de promoción. ' +
        'Asegurate de haber promocionado el vehículo antes.',
    );
  }
  this.clock.advanceMs(days * 24 * 60 * 60 * 1000 + 1000);
});

When(
  'el sistema ejecuta el job de expiración de promociones',
  async function (this: MyWorld) {
    const { PromotionExpiryJob } = await import(
      '@/infrastructure/jobs/promotion-expiry.job'
    );
    const job = this.app.get(PromotionExpiryJob);
    await job.expirePromotions();
  },
);

Then(
  'veo las siguientes opciones de duración:',
  function (this: MyWorld, dataTable: DataTable) {
    const ctx = this.world as any;
    const rows = dataTable.hashes();
    const durations: Array<{ days: number; valueInCents: number }> =
      ctx.promotion_durations;

    expect(durations).toBeDefined();
    expect(durations.length).toBe(rows.length);

    for (const row of rows) {
      const expectedDays = parseDurationDays(row['duracion']);
      const expectedCost = Number(row['costo']);
      const d = durations.find((x) => x.days === expectedDays);
      expect(d).toBeDefined();
      expect(d!.valueInCents).toBe(expectedCost);
    }
  },
);

Then(
  /^el vehículo pasa a estado "(promocionado|no promocionado)"$/,
  async function (this: MyWorld, expectedStatus: string) {
    const vehicleId = getVehicleId(this);

    const res = await api(this).get(`/vehicle/${vehicleId}/promotion`);
    expect(res.status).toBe(200);

    if (expectedStatus === 'promocionado') {
      expect(res.body.active).toBe(true);
    } else {
      expect(res.body.active).toBe(false);
    }
  },
);

Then(
  'el vehículo aparece antes que los no promocionados en los resultados de búsqueda',
  async function (this: MyWorld) {
    const vehicleId = getVehicleId(this);

    // Create a second non-promoted vehicle so we can verify ordering
    const otherRes = await api(this).post('/vehicle', {
      plate: 'OTHER001',
      brand: 'Fiat',
      model: 'Uno',
      year: 2020,
      passengers: 5,
      trunkLiters: 500,
      isAccessible: false,
      transmission: 'Manual',
      photos: ['https://i.com/other.jpg'],
      color: 'Rojo',
      mileage: 10000,
      basePriceCents: 1000000,
      description: null,
      availableFrom: new Date().toISOString().split('T')[0],
      characteristics: [],
      province: 'B',
      city: 'Test',
      address: 'Calle 123',
      latitude: -34.0,
      longitude: -58.0,
    });
    expect(otherRes.status).toBe(201);

    const otherVehicleId = otherRes.body.id;
    const dummyBuffer = Buffer.from('/9j/4AAQ...', 'base64');
    const docsRes = await api(this).uploadFields(
      `/vehicle/${otherVehicleId}/documents`,
      [
        { fieldName: 'title', buffer: dummyBuffer, filename: 'title.jpg' },
        { fieldName: 'greenCard', buffer: dummyBuffer, filename: 'green-card.jpg' },
      ],
    );
    expect(docsRes.status).toBe(201);

    this.clock.advanceMs(60_000);
    const processRes = await api(this).post('/vehicle/documents/process');
    expect(processRes.status).toBe(200);

    const res = await api(this).get('/vehicle?promoted=true');
    expect(res.status).toBe(200);

    const vehicles: Array<{ id: string; isPromoted?: boolean }> = res.body;
    const ourIndex = vehicles.findIndex((v) => v.id === vehicleId);
    expect(ourIndex).toBeGreaterThanOrEqual(0);

    const firstNonPromotedIndex = vehicles.findIndex(
      (v) => v.isPromoted !== true,
    );
    expect(firstNonPromotedIndex).toBeGreaterThanOrEqual(0);
    expect(ourIndex).toBeLessThan(firstNonPromotedIndex);
  },
);

Then(
  'el vehículo vuelve a su posición orgánica en los resultados de búsqueda',
  async function (this: MyWorld) {
    const vehicleId = getVehicleId(this);

    const res = await api(this).get('/vehicle?promoted=true');
    expect(res.status).toBe(200);

    const vehicles: Array<{ id: string; isPromoted?: boolean }> = res.body;
    const ourVehicle = vehicles.find((v) => v.id === vehicleId);
    expect(ourVehicle).toBeDefined();
    expect(ourVehicle!.isPromoted).toBeFalsy();
  },
);

Then(
  'el sistema indica que ya está activa una promoción',
  function (this: MyWorld) {
    const ctx = this.world as any;
    const response = ctx.promotion_response;
    expect(response).toBeDefined();
    expect(response.status).toBe(409);
    expect(response.body.message?.toLowerCase()).toContain(
      'already promoted',
    );
  },
);
