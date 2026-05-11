import { Given, When, Then } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import request from 'supertest';
import { expect } from 'expect';

Given(
  'que un nuevo usuario quiere registrarse con nombre {string}, email {string}, DNI {string}, teléfono {string} y contraseña {string}',
  function (
    this: MyWorld,
    name: string,
    email: string,
    dni: string,
    phone: string,
    password: string,
  ) {
    this.world.register_dto = { name, email, dni, phone, password };
  },
);

Given(
  'que ya existe un usuario registrado con email {string}',
  async function (this: MyWorld, email: string) {
    await request(this.app.getHttpServer()).post('/auth/register').send({
      name: 'Existente',
      email,
      dni: '12345678',
      phone: '1100000000',
      password: 'Passw0rd!',
    });
  },
);

When('envía el formulario de registro', async function (this: MyWorld) {
  this.world.register_response = await request(this.app.getHttpServer())
    .post('/auth/register')
    .send(this.world.register_dto);
});

Then('la cuenta es creada exitosamente', function (this: MyWorld) {
  const res = this.world.register_response;
  expect(res.status).toBe(201);
  expect(res.body.id).toBeDefined();
  expect(res.body.email).toBe(this.world.register_dto.email);
});

Then('el usuario puede acceder a la plataforma', function (this: MyWorld) {
  expect(this.world.register_response.body.name).toBeDefined();
});

Then(
  'el sistema indica que el correo ya está en uso',
  function (this: MyWorld) {
    expect(this.world.register_response.status).toBe(409);
  },
);

Then('no se crea la cuenta', function (this: MyWorld) {
  expect(this.world.register_response.body.id).toBeUndefined();
});

Then('el sistema indica que el email es inválido', function (this: MyWorld) {
  expect(this.world.register_response.status).toBe(400);
});

Then(
  'el sistema indica los requisitos mínimos de contraseña',
  function (this: MyWorld) {
    expect(this.world.register_response.status).toBe(400);
  },
);

Then('el sistema indica que el DNI es inválido', function (this: MyWorld) {
  expect(this.world.register_response.status).toBe(400);
});
