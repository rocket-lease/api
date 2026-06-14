import { Given, When, Then } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import { api } from '../support/http-client';
import { expect } from 'expect';

Given(
  'no tengo preferencias de vehículo guardadas',
  async function (this: MyWorld) {
    const meResponse = await api(this).get('/profile/me');
    expect(meResponse.status).toBe(200);

    const updateResponse = await api(this).patch('/profile/me', {
      name: meResponse.body.name,
      phone: meResponse.body.phone,
      avatarUrl: meResponse.body.avatarUrl,
      preferences: null,
    });
    expect(updateResponse.status).toBe(200);
  },
);

When('accedo al inicio de la app', async function (this: MyWorld) {
  this.world.recommendation_response = await api(this).get('/recommendations');
});

Then(
  'veo una sección {string}',
  function (this: MyWorld, sectionName: string) {
    const response = this.world.recommendation_response;
    expect(response.status).toBe(200);
    expect(response.body.section).toBe(sectionName);
    expect(response.body.vehicles).toBeDefined();
    expect(Array.isArray(response.body.vehicles)).toBe(true);
    expect(response.body.vehicles.length).toBeGreaterThan(0);
  },
);

Then(
  'no veo la sección {string}',
  function (this: MyWorld, sectionName: string) {
    const response = this.world.recommendation_response;
    expect(response.status).toBe(200);
    // No recommendation section when there is no history or preferences
    if (response.body.section !== undefined) {
      // If the API returns a section it must not be the specified one
      expect(response.body.section).not.toBe(sectionName);
    }
    // Vehicles array should be absent or empty
    const vehicles = response.body.vehicles ?? [];
    expect(vehicles.length).toBe(0);
  },
);

Then(
  'la sección contiene vehículos recomendados basados en mi historial y preferencias',
  function (this: MyWorld) {
    const response = this.world.recommendation_response;
    expect(response.status).toBe(200);
    expect(response.body.vehicles.length).toBeGreaterThan(0);
    for (const vehicle of response.body.vehicles) {
      expect(vehicle.id).toBeDefined();
      expect(vehicle.brand).toBeDefined();
      expect(vehicle.model).toBeDefined();
    }
  },
);

Then(
  'los vehículos sugeridos cumplen con mis preferencias de transmisión, accesibilidad y precio',
  async function (this: MyWorld) {
    const response = this.world.recommendation_response;
    expect(response.status).toBe(200);
    expect(response.body.vehicles.length).toBeGreaterThan(0);

    // Fetch current user preferences from profile
    const profileRes = await api(this).get('/profile/me');
    expect(profileRes.status).toBe(200);
    const prefs = profileRes.body.preferences;

    for (const vehicle of response.body.vehicles) {
      // Transmission preference
      if (prefs?.transmission) {
        expect(vehicle.transmission?.toLowerCase()).toBe(
          prefs.transmission.toLowerCase(),
        );
      }

      // Maximum daily price — compare against vehicle's basePriceCents
      if (prefs?.maxPriceDaily != null) {
        const vehicleDailyPrice = vehicle.basePriceCents ?? 0;
        expect(vehicleDailyPrice).toBeLessThanOrEqual(prefs.maxPriceDaily);
      }

      // Accessibility preference
      if (prefs?.accessibility?.length > 0) {
        // If the user requires accessibility the vehicle must be accessible
        expect(vehicle.isAccessible).toBe(true);
      }
    }
  },
);

Then(
  'los vehículos sugeridos son del mismo tipo que los reservados anteriormente',
  async function (this: MyWorld) {
    const response = this.world.recommendation_response;
    expect(response.status).toBe(200);
    expect(response.body.vehicles.length).toBeGreaterThan(0);

    // Retrieve previously reserved vehicles via plate map
    const vehiclePlateIds = Object.values(this.world.vehicle_by_plate ?? {}) as string[];
    expect(vehiclePlateIds.length).toBeGreaterThan(0);

    // Fetch the first previously reserved vehicle for type comparison
    const firstVehicleId = vehiclePlateIds[0];
    const reservedRes = await api(this).get(`/vehicle/${firstVehicleId}`);
    expect(reservedRes.status).toBe(200);
    const reservedVehicle = reservedRes.body;

    // Verify each recommended vehicle shares core type attributes
    for (const vehicle of response.body.vehicles) {
      expect(vehicle.brand).toBeDefined();
      expect(vehicle.model).toBeDefined();
      expect(vehicle.transmission).toBeDefined();
      // Recommended vehicles should share at least the same transmission type
      // as the previously reserved vehicle
      expect(vehicle.transmission?.toLowerCase()).toBe(
        reservedVehicle.transmission?.toLowerCase(),
      );
    }
  },
);
