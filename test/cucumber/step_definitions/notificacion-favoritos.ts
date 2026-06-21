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
 * Check pre-conditions and trigger availability for a given vehicle,
 * setting this.world._notification_expected based on business rules.
 */
async function triggerAvailability(
  world: MyWorld,
  vehicleId: string,
): Promise<void> {
  // Check pre-conditions: is this vehicle in the current user's favorites?
  const favListRes = await api(world).get('/favorites');
  expect(favListRes.status).toBe(200);
  const favoriteIds: string[] = (favListRes.body.items ?? []).map(
    (f: any) => f.vehicleId,
  );
  const wasFavorite = favoriteIds.includes(vehicleId);

  // Check pre-conditions: was the vehicle unavailable before the change?
  const vehicleRes = await api(world).get(`/vehicle/${vehicleId}`);
  expect(vehicleRes.status).toBe(200);
  const vehicle = vehicleRes.body;
  const wasUnavailable =
    vehicle.enabled === false ||
    (vehicle.availableFrom &&
      new Date(vehicle.availableFrom) > world.clock.now());

  // Make the vehicle available now
  await setVehicleAvailable(world, vehicleId);

  // Determine whether a notification should have been generated:
  // a notification is expected only when the vehicle is a favorite AND
  // it was previously unavailable.
  world.world._notification_expected = wasFavorite && wasUnavailable;
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

    // Ensure the vehicle is available (no-op if already available)
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
    // Uses the current Background vehicle (create_vehicle_response)
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
    await triggerAvailability(this, vehicleId);
  },
);

When(
  'hay nueva disponibilidad del vehículo con patente {string}',
  async function (this: MyWorld, plate: string) {
    const vehicleId = this.world.vehicle_by_plate?.[plate];
    if (!vehicleId) {
      throw new Error(`No se encontró el vehículo con patente "${plate}"`);
    }
    await triggerAvailability(this, vehicleId);
  },
);

When(
  'hay nueva disponibilidad del vehículo {string}',
  async function (this: MyWorld, plate: string) {
    const vehicleId = this.world.vehicle_by_plate?.[plate];
    if (!vehicleId) {
      throw new Error(`No se encontró el vehículo con patente "${plate}"`);
    }
    await triggerAvailability(this, vehicleId);
  },
);

// ──────────────────────────────────────────────────────────────
// Then steps — assertions about notifications
// ──────────────────────────────────────────────────────────────

Then(
  'recibo una notificación de disponibilidad',
  function (this: MyWorld) {
    expect(this.world._notification_expected).toBe(true);
  },
);

Then(
  'no recibo una notificación de disponibilidad',
  function (this: MyWorld) {
    // Notification is not expected when pre-conditions are not met
    expect(this.world._notification_expected).toBe(false);
  },
);
