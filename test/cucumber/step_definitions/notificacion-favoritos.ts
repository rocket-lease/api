import { Given, When, Then } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import { api } from '../support/http-client';
import { expect } from 'expect';

/**
 * Helper: retrieve the vehicle id for the "current" favorite vehicle,
 * falling back to the Background vehicle (FAV-NTF) by default.
 */
function getFavoriteVehicleId(world: MyWorld): string {
  const vehicleId =
    world.world.favorite_vehicle_id ??
    world.world.create_vehicle_response?.body?.id;
  if (!vehicleId) {
    throw new Error(
      'No hay vehículo favorito — asegurate de haber ejecutado Given "que tengo el vehículo en mis favoritos"',
    );
  }
  return vehicleId;
}

/**
 * Try a PATCH request; if it fails with 401/403/404 and an owner token is
 * available, retry as the owner.  Returns the successful response (or the
 * first failure if the owner retry also fails).
 */
async function patchAsOwner(
  world: MyWorld,
  url: string,
  body: Record<string, unknown>,
) {
  let res = await api(world).patch(url, body);
  if (![401, 403, 404].includes(res.status)) return res;
  const ownerToken = world.world.tokens_by_alias?.['__owner__'];
  if (!ownerToken) return res;
  const prev = world.world.access_token;
  world.world.access_token = ownerToken;
  res = await api(world).patch(url, body);
  world.world.access_token = prev;
  return res;
}

/**
 * Helper: mark a vehicle as unavailable by setting a far-future availableFrom date.
 */
async function setVehicleUnavailable(
  world: MyWorld,
  vehicleId: string,
): Promise<void> {
  const res = await patchAsOwner(world, `/vehicle/${vehicleId}`, {
    availableFrom: '2099-12-31',
  });
  expect(res.status).toBe(200);
}

/**
 * Helper: mark a vehicle as available by setting a past/current availableFrom date.
 */
async function setVehicleAvailable(
  world: MyWorld,
  vehicleId: string,
): Promise<void> {
  const res = await patchAsOwner(world, `/vehicle/${vehicleId}`, {
    availableFrom: '2026-01-01',
  });
  expect(res.status).toBe(200);
}

/**
 * Check whether a notification for the given vehicle exists
 * by querying the real /notifications endpoint.
 */
async function notificationExistsForVehicle(
  world: MyWorld,
  vehicleId: string,
): Promise<boolean> {
  const res = await api(world).get('/notifications');
  expect(res.status).toBe(200);
  const body = res.body as { notifications: Array<{ title: string; body: string; url: string | null }> };
  const vehicleUrl = `/vehiculos/${vehicleId}`;
  return body.notifications.some((n) => n.url === vehicleUrl);
}

function setAvailabilityTarget(world: MyWorld, vehicleId: string): void {
  world.world._availability_target_id = vehicleId;
}

function getAvailabilityTarget(world: MyWorld): string {
  const id = world.world._availability_target_id;
  if (!id) {
    throw new Error('No hay vehículo con disponibilidad modificada — asegurate de haber ejecutado un When');
  }
  return id;
}

// ──────────────────────────────────────────────────────────────
// Given steps — setting up the pre-conditions
// ──────────────────────────────────────────────────────────────

Given(
  'el vehículo favorito no está disponible actualmente',
  async function (this: MyWorld) {
    const vehicleId = getFavoriteVehicleId(this);
    await setVehicleUnavailable(this, vehicleId);
  },
);

Given(
  'el vehículo favorito ya está disponible',
  async function (this: MyWorld) {
    const vehicleId = getFavoriteVehicleId(this);

    const vehicleRes = await api(this).get(`/vehicle/${vehicleId}`);
    expect(vehicleRes.status).toBe(200);
    const vehicle = vehicleRes.body;

    const isAvailable =
      vehicle.enabled !== false &&
      (!vehicle.availableFrom ||
        new Date(vehicle.availableFrom) <= this.clock.now());

    if (!isAvailable) {
      await setVehicleAvailable(this, vehicleId);
    }
  },
);

Given(
  'el vehículo no está disponible actualmente',
  async function (this: MyWorld) {
    const vehicleId = this.world.create_vehicle_response?.body?.id;
    if (!vehicleId) {
      throw new Error('No hay vehículo creado en el contexto actual');
    }
    await setVehicleUnavailable(this, vehicleId);
  },
);

// ──────────────────────────────────────────────────────────────
// When steps — actions that trigger the notification logic
// ──────────────────────────────────────────────────────────────

When(
  'hay nueva disponibilidad del vehículo favorito',
  async function (this: MyWorld) {
    const vehicleId = getFavoriteVehicleId(this);
    setAvailabilityTarget(this, vehicleId);
    await setVehicleAvailable(this, vehicleId);
  },
);

When(
  'hay nueva disponibilidad del vehículo con patente {string}',
  async function (this: MyWorld, plate: string) {
    const vehicleId = this.world.vehicle_by_plate?.[plate];
    if (!vehicleId) {
      throw new Error(`No se encontró el vehículo con patente "${plate}"`);
    }
    setAvailabilityTarget(this, vehicleId);
    await setVehicleAvailable(this, vehicleId);
  },
);

When(
  'hay nueva disponibilidad del vehículo {string}',
  async function (this: MyWorld, plate: string) {
    const vehicleId = this.world.vehicle_by_plate?.[plate];
    if (!vehicleId) {
      throw new Error(`No se encontró el vehículo con patente "${plate}"`);
    }
    setAvailabilityTarget(this, vehicleId);
    await setVehicleAvailable(this, vehicleId);
  },
);

// ──────────────────────────────────────────────────────────────
// Then steps — assertions about notifications
// ──────────────────────────────────────────────────────────────

Then(
  'recibo una notificación de disponibilidad',
  async function (this: MyWorld) {
    const vehicleId = getAvailabilityTarget(this);
    const exists = await notificationExistsForVehicle(this, vehicleId);
    expect(exists).toBe(true);
  },
);

Then(
  'no recibo una notificación de disponibilidad',
  async function (this: MyWorld) {
    const vehicleId = getAvailabilityTarget(this);
    const exists = await notificationExistsForVehicle(this, vehicleId);
    expect(exists).toBe(false);
  },
);
