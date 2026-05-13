import { Given, When, Then } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import request from 'supertest';
import { expect } from 'expect';
import { StubAuthProvider } from '@/infrastructure/providers/stub.auth.provider';

// ─── Given ────────────────────────────────────────────────────────────────────

Given('que estoy autenticado como conductor', function (this: MyWorld) {
  this.world.auth_token = StubAuthProvider.STUB_TOKEN;
});

Given(
  'que tengo el vehículo {string} en mis favoritos',
  async function (this: MyWorld, vehicleId: string) {
    const res = await request(this.app.getHttpServer())
      .post('/favorites')
      .set('Authorization', `Bearer ${this.world.auth_token}`)
      .send({ vehicleId });
    expect(res.status).toBe(201);
  },
);

// ─── When ─────────────────────────────────────────────────────────────────────

When(
  'agrego el vehículo {string} a favoritos',
  async function (this: MyWorld, vehicleId: string) {
    this.world.favorite_vehicle_id = vehicleId;
    this.world.favorite_response = await request(this.app.getHttpServer())
      .post('/favorites')
      .set('Authorization', `Bearer ${this.world.auth_token}`)
      .send({ vehicleId });
  },
);

When(
  'elimino el vehículo {string} de favoritos',
  async function (this: MyWorld, vehicleId: string) {
    this.world.favorite_vehicle_id = vehicleId;
    this.world.favorite_response = await request(this.app.getHttpServer())
      .delete(`/favorites/${vehicleId}`)
      .set('Authorization', `Bearer ${this.world.auth_token}`);
  },
);

When('cargo mi lista de favoritos', async function (this: MyWorld) {
  this.world.favorite_response = await request(this.app.getHttpServer())
    .get('/favorites')
    .set('Authorization', `Bearer ${this.world.auth_token}`);
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then('el vehículo aparece en mi lista de favoritos', async function (this: MyWorld) {
  expect(this.world.favorite_response.status).toBe(201);

  const listRes = await request(this.app.getHttpServer())
    .get('/favorites')
    .set('Authorization', `Bearer ${this.world.auth_token}`);
  expect(listRes.status).toBe(200);

  const vehicleId = this.world.favorite_vehicle_id;
  const found = listRes.body.items.some((f: any) => f.vehicleId === vehicleId);
  expect(found).toBe(true);
});

Then(
  'la lista contiene el vehículo {string}',
  function (this: MyWorld, vehicleId: string) {
    expect(this.world.favorite_response.status).toBe(200);
    const found = this.world.favorite_response.body.items.some(
      (f: any) => f.vehicleId === vehicleId,
    );
    expect(found).toBe(true);
  },
);

Then(
  'la lista ya no contiene el vehículo {string}',
  async function (this: MyWorld, vehicleId: string) {
    expect(this.world.favorite_response.status).toBe(204);

    const listRes = await request(this.app.getHttpServer())
      .get('/favorites')
      .set('Authorization', `Bearer ${this.world.auth_token}`);
    expect(listRes.status).toBe(200);

    const found = listRes.body.items.some((f: any) => f.vehicleId === vehicleId);
    expect(found).toBe(false);
  },
);

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
