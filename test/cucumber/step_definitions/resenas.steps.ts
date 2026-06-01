import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';
import { useAlias } from './auth';

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
// AC2 — Creación de reseñas (Given steps, se ejecutan desde la óptica del
// conductor que dejó la reserva)
// ============================================================================

Given(
  'que el conductor {string} deja una reseña de {int} estrellas sobre el vehículo con comentario {string}',
  async function (this: MyWorld, alias: string, rating: number, comment: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    const res = await api(this).post(`/reservations/${reservationId}/review`, {
      targetType: 'vehicle',
      rating,
      comment,
    });
    expect(res.status).toBe(201);
  },
);

Given(
  'que el conductor {string} deja una reseña de {int} estrellas sobre el rentador con comentario {string}',
  async function (this: MyWorld, alias: string, rating: number, comment: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    const res = await api(this).post(`/reservations/${reservationId}/review`, {
      targetType: 'rentador',
      rating,
      comment,
    });
    expect(res.status).toBe(201);
  },
);

// ============================================================================
// AC2 — Consulta de reseñas recibidas (óptica del rentador/owner)
// ============================================================================

When(
  'el rentador consulta las reseñas que recibió',
  async function (this: MyWorld) {
    useOwner(this);
    const res = await api(this).get('/reviews/rentador/mine');
    this.world.lastResponse = res;
  },
);

Then('veo {int} reseñas recibidas', function (this: MyWorld, count: number) {
  const res = this.world.lastResponse;
  expect(Array.isArray(res?.body)).toBe(true);
  expect(res.body.length).toBe(count);
});

const targetTypeMap: Record<string, string> = {
  'vehículo': 'vehicle',
  'rentador': 'rentador',
};

Then(
  'la reseña del conductor {string} es sobre el {word} con calificación {int} y comentario {string}',
  function (this: MyWorld, alias: string, targetType: string, rating: number, comment: string) {
    const res = this.world.lastResponse;
    expect(Array.isArray(res?.body)).toBe(true);
    const aliasIndex = Object.entries(this.world.reservations_by_alias ?? {}).find(
      ([a]) => a === alias,
    );
    const review = res.body.find(
      (r: any) =>
        r.reviewerName === alias || (aliasIndex && r.reservationId === aliasIndex[1]),
    );
    expect(review).toBeDefined();
    expect(review.targetType).toBe(targetTypeMap[targetType] ?? targetType);
    expect(review.rating).toBe(rating);
    expect(review.comment).toBe(comment);
  },
);

Then('no tiene reseñas recibidas', function (this: MyWorld) {
  const res = this.world.lastResponse;
  expect(Array.isArray(res?.body)).toBe(true);
  expect(res.body.length).toBe(0);
});
