import { Given, When, Then } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import { api } from '../support/http-client';
import { expect } from 'expect';

When('agrego una tarjeta con los siguientes datos:', async function (this: MyWorld, dataTable: any) {
  const row = dataTable.hashes()[0];
  const payload = {
    type: 'card',
    details: {
      brand: row.marca,
      lastFour: row.ultimos4,
      expMonth: 12,
      expYear: 2030,
      cardholderName: 'Test User'
    }
  };
  this.world.payment_method_response = await api(this).post('/profile/payment-methods', payload);
});

Then('la tarjeta queda guardada en mi lista de medios de pago', async function (this: MyWorld) {
  if (this.world.payment_method_response.status !== 201) {
    expect(this.world.payment_method_response.body).toBe(201);
  }
  expect(this.world.payment_method_response.status).toBe(201);
  const listRes = await api(this).get('/profile/payment-methods');
  expect(listRes.status).toBe(200);
  const found = listRes.body.some((pm: any) => pm.id === this.world.payment_method_response.body.id);
  expect(found).toBe(true);
});

Given('que tengo una tarjeta guardada', async function (this: MyWorld) {
  const payload = {
    type: 'card',
    details: {
      brand: 'Visa',
      lastFour: '1234',
      expMonth: 12,
      expYear: 2030,
      cardholderName: 'Test User'
    }
  };
  const res = await api(this).post('/profile/payment-methods', payload);
  expect(res.status).toBe(201);
  this.world.payment_method_id = res.body.id;
});

Given('que solo tengo un medio de pago', async function (this: MyWorld) {
  const listRes = await api(this).get('/profile/payment-methods');
  for (const pm of listRes.body) {
    await api(this).delete(`/profile/payment-methods/${pm.id}`);
  }
  
  const payload = {
    type: 'card',
    details: {
      brand: 'Visa',
      lastFour: '1234',
      expMonth: 12,
      expYear: 2030,
      cardholderName: 'Test User'
    }
  };
  const res = await api(this).post('/profile/payment-methods', payload);
  expect(res.status).toBe(201);
  this.world.payment_method_id = res.body.id;
});

When('edito la tarjeta para cambiar el titular a {string}', async function (this: MyWorld, titular: string) {
  const payload = {
    type: 'card',
    details: {
      cardholderName: titular
    }
  };
  this.world.payment_method_response = await api(this).patch(`/profile/payment-methods/${this.world.payment_method_id}`, payload);
});

Then('los cambios se guardan correctamente', function (this: MyWorld) {
  expect(this.world.payment_method_response.status).toBe(200);
});

Then('mi lista de medios de pago refleja la modificación', async function (this: MyWorld) {
  const listRes = await api(this).get('/profile/payment-methods');
  const pm = listRes.body.find((p: any) => p.id === this.world.payment_method_id);
  expect(pm.details.cardholderName).toBe('Nuevo Titular');
});

When('elimino la tarjeta', async function (this: MyWorld) {
  this.world.payment_method_response = await api(this).delete(`/profile/payment-methods/${this.world.payment_method_id}`);
});

When('elimino el medio de pago', async function (this: MyWorld) {
  this.world.payment_method_response = await api(this).delete(`/profile/payment-methods/${this.world.payment_method_id}`);
});

Then('desaparece de mi lista de medios de pago', async function (this: MyWorld) {
  expect(this.world.payment_method_response.status).toBe(204);
  const listRes = await api(this).get('/profile/payment-methods');
  const found = listRes.body.some((p: any) => p.id === this.world.payment_method_id);
  expect(found).toBe(false);
});

Then('mi lista de medios de pago queda vacía', async function (this: MyWorld) {
  const listRes = await api(this).get('/profile/payment-methods');
  expect(listRes.body.length).toBe(0);
});
