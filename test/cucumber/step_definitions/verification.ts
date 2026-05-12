import { Given, When, Then } from '@cucumber/cucumber';
import request from 'supertest';
import { expect } from 'expect';
import { MyWorld } from '../support/world';
import { AUTH_PROVIDER } from '@/domain/providers/auth.provider';
import { EMAIL_PROVIDER } from '@/domain/providers/email.provider';
import { SMS_PROVIDER } from '@/domain/providers/sms.provider';
import { StubAuthProvider } from '@/infrastructure/providers/stub.auth.provider';
import { StubEmailProvider } from '@/infrastructure/providers/stub.email.provider';
import { StubSmsProvider } from '@/infrastructure/providers/stub.sms.provider';
import { PrismaService } from '@/infrastructure/database/prisma.service';

function emailStub(world: MyWorld): StubEmailProvider {
  return world.app.get<StubEmailProvider>(EMAIL_PROVIDER);
}

function smsStub(world: MyWorld): StubSmsProvider {
  return world.app.get<StubSmsProvider>(SMS_PROVIDER);
}

function lastSentCodeFor(world: MyWorld, channel: 'email' | 'phone'): string {
  if (channel === 'email') {
    const sent = emailStub(world).sent;
    return sent[sent.length - 1]?.code;
  }
  const sent = smsStub(world).sent;
  return sent[sent.length - 1]?.code;
}

Given(
  'que me registro con nombre {string}, email {string}, DNI {string}, teléfono {string} y contraseña {string}',
  async function (
    this: MyWorld,
    name: string,
    email: string,
    dni: string,
    phone: string,
    password: string,
  ) {
    this.world.register_dto = { name, email, dni, phone, password };
    this.world.register_response = await request(this.app.getHttpServer())
      .post('/auth/register')
      .send(this.world.register_dto);
    expect(this.world.register_response.status).toBe(201);
  },
);

Then(
  'se envió un OTP por email a {string}',
  function (this: MyWorld, email: string) {
    const sent = emailStub(this).sent;
    const match = sent.find((s) => s.email === email);
    expect(match).toBeDefined();
    expect(match!.code).toMatch(/^\d{6}$/);
  },
);

Then(
  'se envió un OTP por SMS al {string}',
  function (this: MyWorld, phone: string) {
    const sent = smsStub(this).sent;
    const match = sent.find((s) => s.phone === phone);
    expect(match).toBeDefined();
    expect(match!.code).toMatch(/^\d{6}$/);
  },
);

When(
  'envío el OTP correcto del canal {string}',
  async function (this: MyWorld, channel: 'email' | 'phone') {
    const code = lastSentCodeFor(this, channel);
    this.world.response = await request(this.app.getHttpServer())
      .post('/verifications/verify')
      .set('Authorization', `Bearer ${StubAuthProvider.STUB_TOKEN}`)
      .send({ channel, code });
  },
);

When(
  'envío el OTP {string} para el canal {string}',
  async function (this: MyWorld, code: string, channel: 'email' | 'phone') {
    this.world.response = await request(this.app.getHttpServer())
      .post('/verifications/verify')
      .set('Authorization', `Bearer ${StubAuthProvider.STUB_TOKEN}`)
      .send({ channel, code });
  },
);

Then(
  'el canal {string} queda verificado',
  function (this: MyWorld, _channel: string) {
    expect(this.world.response.status).toBe(200);
    expect(this.world.response.body.verified).toBe(true);
  },
);

Then(
  'el estado de la cuenta indica email verificado',
  async function (this: MyWorld) {
    const res = await request(this.app.getHttpServer())
      .get('/verifications/status')
      .set('Authorization', `Bearer ${StubAuthProvider.STUB_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(true);
  },
);

Then(
  'el sistema indica código incorrecto con {int} intentos restantes',
  function (this: MyWorld, attemptsLeft: number) {
    expect(this.world.response.status).toBe(200);
    expect(this.world.response.body).toEqual({
      verified: false,
      reason: 'incorrect',
      attemptsLeft,
    });
  },
);

Then(
  'el sistema indica que se agotaron los intentos',
  function (this: MyWorld) {
    expect(this.world.response.status).toBe(200);
    expect(this.world.response.body.verified).toBe(false);
    expect(this.world.response.body.reason).toBe('exhausted');
    expect(this.world.response.body.attemptsLeft).toBe(0);
  },
);

Given(
  'el OTP del canal {string} ya expiró',
  async function (this: MyWorld, channel: 'email' | 'phone') {
    const prisma = this.app.get(PrismaService);
    const authStub = this.app.get<StubAuthProvider>(AUTH_PROVIDER);
    const userId = (await authStub.verifyToken(StubAuthProvider.STUB_TOKEN))
      .userId;
    await prisma.verificationOtp.updateMany({
      where: { userId, channel, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
  },
);

Then(
  'el sistema indica que el OTP expiró y ofrece reenviar uno nuevo',
  function (this: MyWorld) {
    expect(this.world.response.status).toBe(200);
    expect(this.world.response.body).toEqual({
      verified: false,
      reason: 'expired',
      attemptsLeft: 0,
    });
  },
);

Given(
  'pasaron {int} segundos desde el último envío',
  async function (this: MyWorld, seconds: number) {
    const prisma = this.app.get(PrismaService);
    const authStub = this.app.get<StubAuthProvider>(AUTH_PROVIDER);
    const userId = (await authStub.verifyToken(StubAuthProvider.STUB_TOKEN))
      .userId;
    const cutoff = new Date(Date.now() - seconds * 1000);
    await prisma.verificationOtp.updateMany({
      where: { userId, usedAt: null },
      data: { createdAt: cutoff },
    });
  },
);

When(
  'solicito reenviar el OTP del canal {string}',
  async function (this: MyWorld, channel: 'email' | 'phone') {
    this.world.response = await request(this.app.getHttpServer())
      .post('/verifications/send')
      .set('Authorization', `Bearer ${StubAuthProvider.STUB_TOKEN}`)
      .send({ channel });
  },
);

Then(
  'se envió un nuevo OTP por email a {string}',
  function (this: MyWorld, email: string) {
    expect(this.world.response.status).toBe(200);
    const sent = emailStub(this).sent.filter((s) => s.email === email);
    expect(sent.length).toBeGreaterThanOrEqual(2);
  },
);
