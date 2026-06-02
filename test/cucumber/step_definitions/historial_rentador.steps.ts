import { When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';

/**
 * Cambia el token activo al del dueño del vehículo (__owner__).
 * El dueño se registra y autentica cuando se publica un vehículo mediante el
 * step "que existe un vehículo publicado con patente …".
 */
function useOwner(world: MyWorld): void {
  const token = world.world.tokens_by_alias?.['__owner__'];
  if (!token) throw new Error('owner no autenticado — publicá un vehículo primero');
  world.world.access_token = token;
}

/** Devuelve el ID de reserva asociado al alias del conductor. */
function getReservationId(world: MyWorld, alias: string): string {
  const id = world.world.reservations_by_alias?.[alias];
  if (!id) throw new Error(`no hay reserva para el conductor ${alias}`);
  return id;
}

// ============================================================================
// AC1: Historial de reservas (listado + filtros)
// ============================================================================

When('el rentador accede al historial de reservas', async function (this: MyWorld) {
  useOwner(this);
  const res = await api(this).get('/reservations?role=owner&pageSize=100');
  this.world.lastResponse = res;
});

Then('el historial muestra {int} reservas', function (this: MyWorld, count: number) {
  const res = this.world.lastResponse;
  expect(res?.body?.items).toBeDefined();
  expect(res.body.items.length).toBe(count);
});

Then(
  'cada reserva tiene su estado, fechas, vehículo, conductor y monto',
  function (this: MyWorld) {
    const res = this.world.lastResponse;
    expect(res?.body?.items).toBeDefined();
    for (const item of res.body.items) {
      // Estado
      expect(typeof item.status).toBe('string');
      expect(item.status.length).toBeGreaterThan(0);

      // Fechas
      expect(item.startAt).toBeDefined();
      expect(() => new Date(item.startAt)).not.toThrow();
      expect(item.endAt).toBeDefined();
      expect(() => new Date(item.endAt)).not.toThrow();

      // Vehículo
      expect(item.vehicle).toBeDefined();
      expect(item.vehicle.brand).toBeDefined();
      expect(item.vehicle.model).toBeDefined();
      expect(item.vehicle.plate).toBeDefined();

      // Conductor
      expect(item.conductor).toBeDefined();
      expect(typeof item.conductor.name).toBe('string');

      // Monto
      expect(item.totalCents).toBeDefined();
      expect(typeof item.totalCents).toBe('number');
      expect(item.totalCents).toBeGreaterThan(0);
      expect(item.currency).toBe('ARS');
    }
  },
);

When(
  'el rentador filtra el historial por estado {string}',
  async function (this: MyWorld, status: string) {
    useOwner(this);
    const res = await api(this).get(`/reservations?role=owner&status=${status}`);
    this.world.lastResponse = res;
  },
);

Then(
  'el historial muestra solo las reservas confirmadas',
  function (this: MyWorld) {
    const res = this.world.lastResponse;
    expect(res?.body?.items).toBeDefined();
    for (const item of res.body.items) {
      expect(item.status).toBe('confirmed');
    }
  },
);

When(
  'el rentador filtra el historial por período desde {string} hasta {string}',
  async function (this: MyWorld, from: string, to: string) {
    useOwner(this);
    const res = await api(this).get(
      `/reservations?role=owner&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    this.world.lastResponse = res;
  },
);

Then(
  'el historial muestra solo las reservas del período indicado',
  function (this: MyWorld) {
    const res = this.world.lastResponse;
    expect(res?.body?.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThan(0);
  },
);

// ============================================================================
// AC1 — Rentador no autenticado
// ============================================================================

When(
  'el rentador accede al historial de reservas sin haber iniciado sesión',
  async function (this: MyWorld) {
    this.world.access_token = undefined;
    const res = await api(this).get('/reservations?role=owner');
    this.world.lastResponse = res;
  },
);

Then('la aplicación solicita iniciar sesión', function (this: MyWorld) {
  const res = this.world.lastResponse;
  expect(res.status).toBe(401);
});

// ============================================================================
// AC3: Detalle de reserva
// ============================================================================

When(
  'el rentador selecciona la reserva del conductor {string}',
  async function (this: MyWorld, alias: string) {
    useOwner(this);
    const reservationId = getReservationId(this, alias);
    const res = await api(this).get(`/reservations/${reservationId}`);
    this.world.lastResponse = res;
  },
);

Then(
  'veo el detalle completo del alquiler con fechas, vehículo, rentador, importe y contrato',
  function (this: MyWorld) {
    const body = this.world.lastResponse?.body;
    expect(body).toBeDefined();

    // Fechas
    expect(body.startAt).toBeDefined();
    expect(() => new Date(body.startAt)).not.toThrow();
    expect(body.endAt).toBeDefined();
    expect(() => new Date(body.endAt)).not.toThrow();

    // Vehículo
    expect(body.vehicle).toBeDefined();
    expect(body.vehicle.brand).toBeDefined();
    expect(body.vehicle.model).toBeDefined();

    // Rentador
    expect(body.rentador).toBeDefined();
    expect(body.rentador.name).toBeDefined();
    expect(body.rentador.avatarUrl).toBeDefined();

    // Importe
    expect(body.totalCents).toBeDefined();
    expect(typeof body.totalCents).toBe('number');
    expect(body.totalCents).toBeGreaterThan(0);
    expect(body.currency).toBe('ARS');

    // Contrato
    expect(body.contractAcceptedAt).toBeDefined();
    expect(body.contractAcceptedAt).not.toBeNull();
  },
);

Then(
  'veo la reseña que dejó el conductor con calificación {int} y comentario {string}',
  function (this: MyWorld, rating: number, comment: string) {
    const body = this.world.lastResponse?.body;
    expect(body).toBeDefined();
    expect(body.review).toBeDefined();
    expect(body.review.rating).toBe(rating);
    expect(body.review.comment).toBe(comment);
  },
);

Then(
  'la reserva no tiene ninguna reseña asociada',
  function (this: MyWorld) {
    const body = this.world.lastResponse?.body;
    expect(body).toBeDefined();
    expect(body.review == null).toBe(true);
  },
);
