import { Given, When, Then } from '@cucumber/cucumber';
import { api } from '../support/http-client';
import { expect } from 'expect';
import type { MyWorld } from '../support/world';

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
  },
);

Given(
  'tiene preferencias de vehiculo guardadas con transmision {string}, accesibilidad {string} y precio maximo diario {int}',
  async function (
    this: MyWorld,
    transmission: 'automatic' | 'manual',
    accessibilityCsv: string,
    maxPriceDaily: number,
  ) {
    const meResponse = await api(this).get('/profile/me');
    expect(meResponse.status).toBe(200);

    const updateResponse = await api(this).patch('/profile/me', {
      name: meResponse.body.name,
      phone: meResponse.body.phone,
      avatarUrl: meResponse.body.avatarUrl,
      preferences: {
        transmission,
        accessibility: accessibilityCsv
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        maxPriceDaily,
      },
    });

    expect(updateResponse.status).toBe(200);
  },
);

When('solicita su perfil', async function (this: MyWorld) {
  this.world.profile_response = await api(this).get('/profile/me');
});

When(
  'actualiza su perfil con nombre {string}, telefono {string}, transmision {string}, accesibilidad {string} y precio maximo diario {int}',
  async function (
    this: MyWorld,
    name: string,
    phone: string,
    transmission: 'automatic' | 'manual',
    accessibilityCsv: string,
    maxPriceDaily: number,
  ) {
    const meResponse = await api(this).get('/profile/me');
    expect(meResponse.status).toBe(200);

    this.world.profile_payload = {
      name,
      phone,
      avatarUrl: meResponse.body.avatarUrl,
      preferences: {
        transmission,
        accessibility: accessibilityCsv
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        maxPriceDaily,
      },
    };

    this.world.update_profile_response = await api(this).patch(
      '/profile/me',
      this.world.profile_payload,
    );
  },
);

When(
  'sube una nueva foto de perfil {string}',
  async function (this: MyWorld, filename: string) {
    this.world.upload_avatar_response = await api(this).upload(
      '/profile/me/avatar',
      'file',
      Buffer.from('fake-image-content'),
      filename,
    );
  },
);

Then(
  've sus datos personales, estado de verificacion, nivel, score y preferencias',
  function (this: MyWorld) {
    const res = this.world.profile_response;
    expect(res.status).toBe(200);
    expect(res.body.name).toBeDefined();
    expect(res.body.email).toBeDefined();
    expect(res.body.phone).toBeDefined();
    expect(res.body.verificationStatus).toBeDefined();
    expect(res.body.level).toBeDefined();
    expect(typeof res.body.reputationScore).toBe('number');
    expect(res.body.preferences).toBeDefined();
  },
);

Then(
  'los cambios del perfil quedan guardados y visibles inmediatamente',
  async function (this: MyWorld) {
    expect(this.world.update_profile_response.status).toBe(200);
    expect(this.world.upload_avatar_response.status).toBe(200);

    const meResponse = await api(this).get('/profile/me');

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.name).toBe(this.world.profile_payload.name);
    expect(meResponse.body.phone).toBe(this.world.profile_payload.phone);
    expect(meResponse.body.preferences.transmission).toBe(
      this.world.profile_payload.preferences.transmission,
    );
    expect(meResponse.body.preferences.accessibility).toEqual(
      this.world.profile_payload.preferences.accessibility,
    );
    expect(meResponse.body.preferences.maxPriceDaily).toBe(
      this.world.profile_payload.preferences.maxPriceDaily,
    );
    expect(meResponse.body.avatarUrl).toContain(
      'https://stub-cloudinary.local/avatars/',
    );
  },
);

Then(
  'recibe las preferencias guardadas para precargar filtros de busqueda',
  function (this: MyWorld) {
    const res = this.world.profile_response;
    expect(res.status).toBe(200);
    expect(res.body.preferences).toEqual({
      transmission: 'manual',
      accessibility: ['silla plegable'],
      maxPriceDaily: 38000,
    });
  },
);
