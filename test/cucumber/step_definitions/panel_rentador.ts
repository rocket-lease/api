import { When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';

function useOwner(world: MyWorld): void {
  const token = world.world.tokens_by_alias?.['__owner__'];
  if (!token) throw new Error('owner no autenticado — publicá un vehículo primero');
  world.world.access_token = token;
}

When('el rentador consulta su panel de reservas', async function (this: MyWorld) {
  useOwner(this);
  const res = await api(this).get('/reservations?role=owner');
  this.world.lastResponse = res;
});

When(
  'el rentador filtra su panel por estado {string}',
  async function (this: MyWorld, status: string) {
    useOwner(this);
    const res = await api(this).get(`/reservations?role=owner&status=${status}`);
    this.world.lastResponse = res;
  },
);

When(
  'el rentador consulta su panel con página {int} y tamaño {int}',
  async function (this: MyWorld, page: number, pageSize: number) {
    useOwner(this);
    const res = await api(this).get(
      `/reservations?role=owner&page=${page}&pageSize=${pageSize}`,
    );
    this.world.lastResponse = res;
  },
);

When('consulto el panel del rentador sin token', async function (this: MyWorld) {
  this.world.access_token = undefined;
  const res = await api(this).get('/reservations?role=owner');
  this.world.lastResponse = res;
});

Then('recibo HTTP {int}', function (this: MyWorld, expected: number) {
  const res = this.world.lastResponse;
  if (!res) throw new Error('no hay respuesta capturada');
  expect(res.status).toBe(expected);
});

Then(
  'el panel contiene {int} reserva',
  function (this: MyWorld, count: number) {
    const res = this.world.lastResponse;
    expect(res?.body?.items).toBeDefined();
    expect(res.body.items.length).toBe(count);
  },
);

Then(
  'el panel contiene {int} reserva en estado {string}',
  function (this: MyWorld, count: number, status: string) {
    const res = this.world.lastResponse;
    expect(res?.body?.items).toBeDefined();
    const filtered = res.body.items.filter(
      (r: { status: string }) => r.status === status,
    );
    expect(filtered.length).toBe(count);
  },
);

Then('el total reportado es {int}', function (this: MyWorld, total: number) {
  const res = this.world.lastResponse;
  expect(res?.body?.total).toBe(total);
});
