import { Given, When, Then } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import { api } from '../support/http-client';
import { expect } from 'expect';
import { IdentityService } from '@/application/identity.service';

export async function registerAndLogin(
  world: MyWorld,
  alias: string,
): Promise<string> {
  const email = `conductor-${alias.toLowerCase()}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`;
  const password = 'Passw0rd!';
  await api(world).post('/auth/register', {
    name: `Conductor ${alias}`,
    email,
    dni: '12345678',
    phone: '1123456789',
    password,
  });
  const loginRes = await api(world).post('/auth/login', { email, password });
  const token = loginRes.body.access_token;
  if (!world.world.tokens_by_alias) world.world.tokens_by_alias = {};
  world.world.tokens_by_alias[alias] = token;
  return token;
}

export function useAlias(world: MyWorld, alias: string): void {
  const token = world.world.tokens_by_alias?.[alias];
  if (!token) throw new Error(`conductor ${alias} no autenticado`);
  world.world.access_token = token;
}

async function verifyCurrentIdentity(world: MyWorld): Promise<void> {
  const response = await api(world).uploadFields('/identity/me/verification', [
    { fieldName: 'frontDni', buffer: Buffer.from('dni-front'), filename: 'dni-front.jpg' },
    { fieldName: 'backDni', buffer: Buffer.from('dni-back'), filename: 'dni-back.jpg' },
    { fieldName: 'selfie', buffer: Buffer.from('dni-selfie'), filename: 'dni-selfie.jpg' },
  ]);

  expect(response.status).toBe(200);
  world.clock.advanceMs(31_000);
  await world.app.get(IdentityService).processDueVerifications();
}

export async function registerAndLoginVerified(
  world: MyWorld,
  alias: string,
): Promise<string> {
  const token = await registerAndLogin(world, alias);
  useAlias(world, alias);
  await verifyCurrentIdentity(world);

  if (!world.world.identity_verified_by_alias) {
    world.world.identity_verified_by_alias = {};
  }
  world.world.identity_verified_by_alias[alias] = true;

  return token;
}

Given(
  'que existe un usuario registrado con email {string} y contraseña {string}',
  async function (this: MyWorld, email: string, password: string) {
    await api(this).post('/auth/register', {
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
  await api(this).post('/auth/register', {
    name: 'Test',
    email,
    dni: '12345678',
    phone: '1123456789',
    password: 'Passw0rd!',
  });
  const loginRes = await api(this).post('/auth/login', {
    email,
    password: 'Passw0rd!',
  });
  this.world.access_token = loginRes.body.access_token;
  await verifyCurrentIdentity(this);
});

Given(
  'que existe un usuario autenticado con email {string} y contraseña {string}',
  async function (this: MyWorld, email: string, password: string) {
    await api(this).post('/auth/register', {
      name: 'Usuario Perfil',
      email,
      dni: '12345678',
      phone: '1123456789',
      password,
    });

    const loginResponse = await api(this).post('/auth/login', {
      email,
      password,
    });

    expect(loginResponse.status).toBe(201);
    this.world.access_token = loginResponse.body.access_token;
    await verifyCurrentIdentity(this);
  },
);

Given(
  'que soy un conductor {string} autenticado',
  async function (this: MyWorld, alias: string) {
    await registerAndLoginVerified(this, alias);
    useAlias(this, alias);
  },
);

Given('que no estoy autenticado', async function (this: MyWorld) {
  this.world.access_token = undefined;
  this.world.tokens_by_alias = {};
});

When(
  'intento iniciar sesión con email {string} y contraseña {string}',
  async function (this: MyWorld, email: string, password: string) {
    this.world.login_response = await api(this).post('/auth/login', {
      email,
      password,
    });
  },
);

Then('el login es exitoso', function (this: MyWorld) {
  expect(this.world.login_response.status).toBe(201);
});

Then('recibo un token de acceso', function (this: MyWorld) {
  const body = this.world.login_response.body;
  expect(body.access_token).toBeDefined();
  expect(body.refresh_token).toBeDefined();
  expect(body.expires_in).toBeDefined();
});

Then('el sistema rechaza el login con error 400', function (this: MyWorld) {
  expect(this.world.login_response.status).toBe(400);
});
