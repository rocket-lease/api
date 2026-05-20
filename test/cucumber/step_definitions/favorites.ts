import { Given, When, Then } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import { api } from '../support/http-client';
import { expect } from 'expect';

Given('que tengo el vehículo en mis favoritos', async function (this: MyWorld) {
  const vehicleId = this.world.create_vehicle_response.body.id;
  this.world.favorite_vehicle_id = vehicleId;
  const res = await api(this).post('/favorites', { vehicleId });
  expect(res.status).toBe(201);
});

When('agrego el vehículo a favoritos', async function (this: MyWorld) {
  const vehicleId = this.world.create_vehicle_response.body.id;
  this.world.favorite_vehicle_id = vehicleId;
  this.world.favorite_response = await api(this).post('/favorites', {
    vehicleId,
  });
});

When('elimino el vehículo de favoritos', async function (this: MyWorld) {
  const vehicleId =
    this.world.create_vehicle_response?.body?.id ??
    '00000000-0000-0000-0000-000000000000';
  this.world.favorite_response = await api(this).delete(
    `/favorites/${vehicleId}`,
  );
});

When('cargo mi lista de favoritos', async function (this: MyWorld) {
  this.world.favorite_response = await api(this).get('/favorites');
});

Then(
  'el vehículo aparece en mi lista de favoritos',
  async function (this: MyWorld) {
    expect(this.world.favorite_response.status).toBe(201);

    const listRes = await api(this).get('/favorites');
    expect(listRes.status).toBe(200);

    const found = listRes.body.items.some(
      (f: any) => f.vehicleId === this.world.favorite_vehicle_id,
    );
    expect(found).toBe(true);
  },
);

Then('la lista contiene el vehículo', function (this: MyWorld) {
  expect(this.world.favorite_response.status).toBe(200);
  const found = this.world.favorite_response.body.items.some(
    (f: any) => f.vehicleId === this.world.favorite_vehicle_id,
  );
  expect(found).toBe(true);
});

Then('la lista ya no contiene el vehículo', async function (this: MyWorld) {
  expect(this.world.favorite_response.status).toBe(204);

  const listRes = await api(this).get('/favorites');
  expect(listRes.status).toBe(200);

  const found = listRes.body.items.some(
    (f: any) => f.vehicleId === this.world.favorite_vehicle_id,
  );
  expect(found).toBe(false);
});

Then(
  'el sistema indica que el favorito ya existe con código {int}',
  function (this: MyWorld, statusCode: number) {
    expect(this.world.favorite_response.status).toBe(statusCode);
  },
);

Then(
  'el sistema indica que el favorito no existe con código {int}',
  function (this: MyWorld, statusCode: number) {
    expect(this.world.favorite_response.status).toBe(statusCode);
  },
);

Then('la lista de favoritos está vacía', function (this: MyWorld) {
  expect(this.world.favorite_response.status).toBe(200);
  expect(this.world.favorite_response.body.items).toHaveLength(0);
});
