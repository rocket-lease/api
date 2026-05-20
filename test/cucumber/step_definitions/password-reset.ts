import { When, Then } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import { api } from '../support/http-client';
import { expect } from 'expect';
import { AUTH_PROVIDER } from '@/domain/providers/auth.provider';
import { StubAuthProvider } from '@/infrastructure/providers/stub.auth.provider';

When(
  'solicito recuperar contraseña para el email {string}',
  async function (this: MyWorld, email: string) {
    this.world.response = await api(this).post('/auth/forgot-password', {
      email,
    });
  },
);

When(
  'envío un reset de contraseña con token válido y nueva contraseña {string}',
  async function (this: MyWorld, newPassword: string) {
    this.world.response = await api(this).post('/auth/reset-password', {
      accessToken: StubAuthProvider.STUB_TOKEN,
      newPassword,
    });
  },
);

When(
  'envío un reset de contraseña con token {string} y nueva contraseña {string}',
  async function (this: MyWorld, accessToken: string, newPassword: string) {
    this.world.response = await api(this).post('/auth/reset-password', {
      accessToken,
      newPassword,
    });
  },
);

Then(
  'el sistema confirma que se envió el mail de recuperación',
  function (this: MyWorld) {
    expect(this.world.response.status).toBe(200);
    expect(this.world.response.body.message).toBeDefined();
  },
);

Then(
  'se registró un envío de mail de recuperación a {string}',
  function (this: MyWorld, email: string) {
    const provider = this.app.get<StubAuthProvider>(AUTH_PROVIDER);
    expect(provider.resetEmailsSent).toContain(email);
  },
);

Then('el sistema confirma el cambio de contraseña', function (this: MyWorld) {
  expect(this.world.response.status).toBe(200);
  const provider = this.app.get<StubAuthProvider>(AUTH_PROVIDER);
  expect(provider.passwordUpdates.length).toBeGreaterThan(0);
});

Then(
  'el sistema rechaza el reset por token inválido',
  function (this: MyWorld) {
    expect(this.world.response.status).toBe(400);
  },
);



Then(
  'el sistema rechaza el reset por contraseña débil',
  function (this: MyWorld) {
    expect(this.world.response.status).toBe(400);
  },
);
