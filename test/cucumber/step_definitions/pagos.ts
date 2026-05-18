import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { MyWorld } from '../support/world';
import { api } from '../support/http-client';
import { registerAndLogin, useAlias } from './auth';

function getReservationId(world: MyWorld, alias: string): string {
  const id = world.world.reservations_by_alias?.[alias];
  if (!id) throw new Error(`no hay reserva para ${alias}`);
  return id;
}

// -- Payment methods listing --

When(
  'el conductor {string} consulta los métodos de pago disponibles',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    this.world.reservation_response = await api(this).get(
      `/reservations/${reservationId}/payment-methods`,
    );
  },
);

Then(
  'el conductor {string} ve métodos de pago: {string}',
  function (this: MyWorld, _alias: string, methodsCsv: string) {
    const expected = methodsCsv
      .split(',')
      .map((m) => m.trim().replace(/"/g, ''));
    const body = this.world.reservation_response.body;
    expect(body.methods).toBeDefined();
    expect(body.methods).toEqual(expected);
  },
);

// -- Bank transfer initiation --

When(
  'el conductor {string} inicia pago por transferencia bancaria',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    this.world.reservation_response = await api(this).post(
      `/reservations/${reservationId}/transfer`,
    );
  },
);

Then(
  'la reserva tiene un código de transferencia generado',
  function (this: MyWorld) {
    const body = this.world.reservation_response.body;
    expect(body.transferCode).toBeDefined();
    expect(typeof body.transferCode).toBe('string');
    expect(body.transferCode.length).toBeGreaterThan(0);
  },
);

Then('la transferencia expira en 2 horas', function (this: MyWorld) {
  const body = this.world.reservation_response.body;
  expect(body.transferExpiresAt).toBeDefined();
  const expiresAt = new Date(body.transferExpiresAt).getTime();
  const now = this.clock.now().getTime();
  const diffHours = (expiresAt - now) / (1000 * 60 * 60);
  expect(Math.abs(diffHours - 2)).toBeLessThanOrEqual(0.1);
});

// -- Transfer expiry --

When(
  'transcurren {int} horas sin acreditar la transferencia',
  function (this: MyWorld, hours: number) {
    this.clock.advanceMs(hours * 60 * 60 * 1000);
  },
);

When(
  'el sistema ejecuta el job de expiración de transferencias',
  async function (this: MyWorld) {
    const { ReservationExpiryJob } = await import(
      '@/infrastructure/jobs/reservation-expiry.job'
    );
    const job = this.app.get(ReservationExpiryJob);
    await job.expireTransfers();
  },
);

// -- Voucher and notification assertions --

Then('se genera un voucher QR para la reserva', function (this: MyWorld) {
  const body = this.world.reservation_response.body;
  expect(body.voucher).toBeDefined();
  expect(body.voucher.qrCode).toBeDefined();
  expect(typeof body.voucher.qrCode).toBe('string');
});

Then('se notifica al conductor y al rentador', function (this: MyWorld) {
  // Stub assertion: notification provider logs but we verify the system didn't throw
  const body = this.world.reservation_response.body;
  expect(body.notified).toBe(true);
});

// -- Digital wallet payment --

When(
  'el conductor {string} confirma el pago con {string} y proveedor {string}',
  async function (
    this: MyWorld,
    alias: string,
    _method: string,
    walletProvider: string,
  ) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    this.world.reservation_response = await api(this).post(
      `/reservations/${reservationId}/payment`,
      { paymentMethod: 'digital_wallet', walletProvider },
    );
  },
);

// -- Bank transfer confirmation (acreditación) --

When(
  'se acredita la transferencia bancaria del conductor {string}',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    this.world.reservation_response = await api(this).post(
      `/reservations/${reservationId}/transfer/confirm`,
    );
  },
);
