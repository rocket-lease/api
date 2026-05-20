import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';
import { PrismaService } from '@/infrastructure/database/prisma.service';

Then('el pago es exitoso', function (this: MyWorld) {
  expect(this.world.reservation_response.status).toBe(200);
});

Then('la respuesta incluye un "voucherToken" válido', function (this: MyWorld) {
  const body = this.world.reservation_response.body;
  expect(body.voucherToken).toBeDefined();
  expect(typeof body.voucherToken).toBe('string');
  expect(body.voucherToken.length).toBeGreaterThan(0);
  this.world.voucher_token = body.voucherToken;
});

Then('puedo obtener el voucher de la reserva con los datos del conductor y vehículo', async function (this: MyWorld) {
  const reservationId = this.world.reservation_response.body.id;
  const res = await api(this).get(`/reservations/${reservationId}/voucher`);
  expect(res.status).toBe(200);
  expect(res.body.reservationId).toBe(reservationId);
  expect(res.body.voucherToken).toBe(this.world.voucher_token);
  expect(res.body.conductor).toBeDefined();
  expect(res.body.vehicle).toBeDefined();
});

When('el rentador escanea y verifica el token del voucher', async function (this: MyWorld) {
  const token = this.world.voucher_token || this.world.reservation_response.body.voucherToken;
  this.world.verification_response = await api(this).get(`/reservations/voucher/verify/${token}`);
});

Then('la verificación es exitosa indicando que el voucher es válido', function (this: MyWorld) {
  expect(this.world.verification_response.status).toBe(200);
  expect(this.world.verification_response.body.isValid).toBe(true);
  expect(this.world.verification_response.body.status).toBe('confirmed');
});

Given('la reserva es cancelada a través del vehículo', async function (this: MyWorld) {
  const prisma = this.app.get(PrismaService);
  const reservationId = this.world.reservation_response.body.id;
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: 'cancelled' },
  });
});

Then('la verificación indica que el voucher no es válido', function (this: MyWorld) {
  expect(this.world.verification_response.status).toBe(200);
  expect(this.world.verification_response.body.isValid).toBe(false);
  expect(this.world.verification_response.body.status).toBe('cancelled');
});
