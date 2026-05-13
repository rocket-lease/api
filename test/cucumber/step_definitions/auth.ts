import { Given, When, Then } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import request from 'supertest';
import { expect } from 'expect';

Given(
  'que existe un usuario registrado con email {string} y contraseña {string}',
  async function (this: MyWorld, email: string, password: string) {
    await request(this.app.getHttpServer()).post('/auth/register').send({
      name: 'Usuario Test',
      email,
      dni: '12345678',
      phone: '1123456789',
      password,
    });
  },
);

Given('que estoy autenticado', async function (this: MyWorld) {
  const email = `test-${Date.now()}@example.com`;
  await request(this.app.getHttpServer()).post('/auth/register').send({
    name: 'Test', email, dni: '12345678', phone: '1123456789', password: 'Passw0rd!',
  });
  const loginRes = await request(this.app.getHttpServer())
    .post('/auth/login').send({ email, password: 'Passw0rd!' });
  this.world.access_token = loginRes.body.access_token;
});

When(
  'el usuario intenta iniciar sesión con email {string} y contraseña {string}',
  async function (this: MyWorld, email: string, password: string) {
    this.world.login_response = await request(this.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
  },
);

Then('el login es exitoso', function (this: MyWorld) {
  expect(this.world.login_response.status).toBe(201);
});

Then('recibe un token de acceso', function (this: MyWorld) {
  const body = this.world.login_response.body;
  expect(body.access_token).toBeDefined();
  expect(body.refresh_token).toBeDefined();
  expect(body.expires_in).toBeDefined();
});

Then('el sistema rechaza el login con error 400', function (this: MyWorld) {
  expect(this.world.login_response.status).toBe(400);
});
