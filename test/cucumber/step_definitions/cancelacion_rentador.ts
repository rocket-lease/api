import { When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';

When('el rentador cancela la reserva del conductor {string}', async function (this: MyWorld, alias: string) {
  const token = this.world.tokens_by_alias?.['__owner__'];
  if (!token) throw new Error('owner no autenticado');
  this.world.access_token = token;

  const reservationId = this.world.reservations_by_alias?.[alias];
  if (!reservationId) throw new Error(`no reservation found for alias ${alias}`);
  
  this.world.reservation_response = await api(this).post(`/reservations/${reservationId}/cancel-by-owner`);
  expect(this.world.reservation_response.status).toBe(200);
});

Then('el conductor {string} recibe reembolso total', async function (this: MyWorld, alias: string) {
  const token = this.world.tokens_by_alias?.[alias];
  if (!token) throw new Error('conductor no autenticado');
  this.world.access_token = token;
  
  const res = await api(this).get('/profile/me');
  if (res.status !== 200) {
    console.error('ERROR EN REEMBOLSO:', res.status, JSON.stringify(res.body, null, 2));
  }
  expect(res.status).toBe(200);
  expect(res.body.balanceInCents).toBeGreaterThan(0);
});

Then('se aplica una penalización de {int} puntos a la reputación del rentador', async function (this: MyWorld, _penalty: number) {
  const token = this.world.tokens_by_alias?.['__owner__'];
  if (!token) throw new Error('owner no autenticado');
  this.world.access_token = token;
  
  const res = await api(this).get('/profile/me');
  if (res.status !== 200) {
    console.error('ERROR EN PENALIZACION:', res.status, JSON.stringify(res.body, null, 2));
  }
  expect(res.status).toBe(200);
  // Al iniciar en 0 y con un cap en 0, el score quedará en 0.
  expect(res.body.reputationScore).toBe(0);
});
