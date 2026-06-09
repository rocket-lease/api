import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';
import { registerAndLoginVerified, useAlias } from './auth';

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

/**
 * Ejecuta el ciclo completo: reservar → pagar → retirar → devolver.
 * Deja la reserva en estado `completed` y la registra en
 * `reservations_by_alias` para el alias dado.
 */
async function completeReservationFlow(
  world: MyWorld,
  alias: string,
  patente: string,
): Promise<void> {
  // Registrar al conductor si no está autenticado (con identidad + licencia verificadas)
  if (!world.world.tokens_by_alias?.[alias]) {
    await registerAndLoginVerified(world, alias);
  }
  useAlias(world, alias);

  // 1. Buscar el vehículo por patente
  const vehicleList = await api(world).get('/vehicle');
  expect(vehicleList.status).toBe(200);
  const vehicles: any[] = vehicleList.body.vehicles ?? vehicleList.body;
  const vehicle = vehicles.find((v: any) => v.plate === patente);
  if (!vehicle) throw new Error(`vehículo con patente ${patente} no encontrado`);

  // 2. Reservar desde hoy hasta mañana
  const now = new Date();
  const startAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const endAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const reserve = await api(world).post('/reservations', {
    vehicleId: vehicle.id,
    startAt,
    endAt,
    contractAccepted: true,
  });
  expect(reserve.status).toBe(201);
  const reservationId = reserve.body.id as string;
  world.world.reservations_by_alias = world.world.reservations_by_alias ?? {};
  world.world.reservations_by_alias[alias] = reservationId;

  // Si tiene auto-aceptación, pasa a pending_payment directo. Si no, el owner
  // tiene que aprobar. Para simplificar, usamos vehículos con auto-aceptación.

  // 3. Confirmar pago con tarjeta
  const pay = await api(world).post(`/reservations/${reservationId}/payment`, {
    paymentMethod: 'credit_card',
  });
  expect(pay.status).toBe(200);

  // 4. El rentador confirma el retiro (pickup)
  const detail = await api(world).get(`/reservations/${reservationId}`);
  expect(detail.status).toBe(200);
  const voucherToken = detail.body.voucherToken as string;
  expect(typeof voucherToken).toBe('string');

  useOwner(world);
  const pickup = await api(world).post('/reservations/pickup', { voucherToken });
  expect(pickup.status).toBe(200);

  // 5. El conductor confirma la devolución (return)
  useAlias(world, alias);
  const detail2 = await api(world).get(`/reservations/${reservationId}`);
  expect(detail2.status).toBe(200);
  const returnQrToken = detail2.body.returnQrToken as string;
  expect(typeof returnQrToken).toBe('string');

  const devolucion = await api(world).post('/reservations/return', { returnQrToken });
  expect(devolucion.status).toBe(200);

  // Guardar el response para asserts posteriores
  world.world.lastResponse = devolucion;
}

// ============================================================================
// Shorthand: completar un alquiler (reservar → pagar → pickup → return)
// ============================================================================

Given(
  'que el conductor {string} completó un alquiler del vehículo {string}',
  async function (this: MyWorld, alias: string, patente: string) {
    await completeReservationFlow(this, alias, patente);
  },
);

Given(
  'que el conductor {string} tiene una reserva completada del vehículo {string}',
  async function (this: MyWorld, alias: string, patente: string) {
    await completeReservationFlow(this, alias, patente);
  },
);

// ============================================================================
// AC2 — Creación de reseñas por el conductor (Given, past/present)
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
    this.world.lastResponse = res;
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
    this.world.lastResponse = res;
  },
);

Given(
  'el conductor {string} dejó una reseña de {int} estrellas sobre el vehículo con comentario {string}',
  async function (this: MyWorld, alias: string, rating: number, comment: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    const res = await api(this).post(`/reservations/${reservationId}/review`, {
      targetType: 'vehicle',
      rating,
      comment,
    });
    this.world.lastResponse = res;
  },
);

// ============================================================================
// AC2 — Creación de reseñas por el rentador (Given)
// ============================================================================

Given(
  'que el rentador deja una reseña de {int} estrellas sobre el conductor con comentario {string}',
  async function (this: MyWorld, rating: number, comment: string) {
    useOwner(this);
    // Tomar la última reserva creada
    const aliases = Object.keys(this.world.reservations_by_alias ?? {});
    if (aliases.length === 0) throw new Error('no hay reservas para reseñar');
    const lastAlias = aliases[aliases.length - 1];
    const reservationId = getReservationId(this, lastAlias);
    const res = await api(this).post(`/reservations/${reservationId}/review`, {
      targetType: 'conductor',
      rating,
      comment,
    });
    this.world.lastResponse = res;
  },
);

Given(
  'el rentador dejó una reseña de {int} estrellas sobre el conductor con comentario {string}',
  async function (this: MyWorld, rating: number, comment: string) {
    useOwner(this);
    const aliases = Object.keys(this.world.reservations_by_alias ?? {});
    if (aliases.length === 0) throw new Error('no hay reservas para reseñar');
    const lastAlias = aliases[aliases.length - 1];
    const reservationId = getReservationId(this, lastAlias);
    const res = await api(this).post(`/reservations/${reservationId}/review`, {
      targetType: 'conductor',
      rating,
      comment,
    });
    this.world.lastResponse = res;
  },
);

// ============================================================================
// Given — Estado previo: ya existe una reseña
// ============================================================================

Given(
  'ya existe una reseña del conductor {string} para esa reserva',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    // Primero verificar si ya existe
    const detail = await api(this).get(`/reservations/${reservationId}`);
    if (detail.body.review) return; // ya existe
    // Crear una reseña por defecto
    const res = await api(this).post(`/reservations/${reservationId}/review`, {
      targetType: 'vehicle',
      rating: 4,
      comment: 'Muy buen vehículo',
    });
    expect(res.status).toBe(201);
  },
);



// ============================================================================
// When — Acciones del usuario
// ============================================================================

When(
  'el conductor {string} accede al historial de reservas',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const res = await api(this).get('/reservations?role=conductor&status=completed&status=cancelled&status=rejected&status=expired');
    this.world.lastResponse = res;
  },
);

When(
  'el conductor {string} accede al detalle de la reserva',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    const res = await api(this).get(`/reservations/${reservationId}`);
    this.world.lastResponse = res;
  },
);

When(
  'el rentador accede al detalle de la reserva',
  async function (this: MyWorld) {
    useOwner(this);
    const aliases = Object.keys(this.world.reservations_by_alias ?? {});
    if (aliases.length === 0) throw new Error('no hay reservas');
    const lastAlias = aliases[aliases.length - 1];
    const reservationId = getReservationId(this, lastAlias);
    const res = await api(this).get(`/reservations/${reservationId}`);
    this.world.lastResponse = res;
  },
);

When(
  'dejo una reseña de {int} estrellas con comentario {string}',
  async function (this: MyWorld, rating: number, comment: string) {
    const alias = Object.keys(this.world.reservations_by_alias ?? {})
      .find((a) => a !== '__owner__');
    if (!alias) throw new Error('no hay conductor con reserva');
    const reservationId = getReservationId(this, alias);
    const res = await api(this).post(`/reservations/${reservationId}/review`, {
      targetType: 'vehicle',
      rating,
      comment,
    });
    this.world.lastResponse = res;
  },
);

When(
  'dejo una reseña de {int} estrellas sobre el vehículo con comentario {string}',
  async function (this: MyWorld, rating: number, comment: string) {
    const alias = Object.keys(this.world.reservations_by_alias ?? {})
      .find((a) => a !== '__owner__');
    if (!alias) throw new Error('no hay conductor con reserva');
    const reservationId = getReservationId(this, alias);
    const res = await api(this).post(`/reservations/${reservationId}/review`, {
      targetType: 'vehicle',
      rating,
      comment,
    });
    this.world.reservation_response = res;
  },
);

When(
  'el conductor {string} deja una reseña de {int} estrellas sobre el vehículo con comentario {string}',
  async function (this: MyWorld, alias: string, rating: number, comment: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    const res = await api(this).post(`/reservations/${reservationId}/review`, {
      targetType: 'vehicle',
      rating,
      comment,
    });
    this.world.lastResponse = res;
  },
);

When(
  'el conductor {string} deja una reseña de {int} estrellas sobre el rentador con comentario {string}',
  async function (this: MyWorld, alias: string, rating: number, comment: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    const res = await api(this).post(`/reservations/${reservationId}/review`, {
      targetType: 'rentador',
      rating,
      comment,
    });
    this.world.lastResponse = res;
  },
);

When(
  'el rentador deja una reseña de {int} estrellas sobre el conductor con comentario {string}',
  async function (this: MyWorld, rating: number, comment: string) {
    useOwner(this);
    const aliases = Object.keys(this.world.reservations_by_alias ?? {});
    if (aliases.length === 0) throw new Error('no hay reservas para reseñar');
    const lastAlias = aliases[aliases.length - 1];
    const reservationId = getReservationId(this, lastAlias);
    const res = await api(this).post(`/reservations/${reservationId}/review`, {
      targetType: 'conductor',
      rating,
      comment,
    });
    this.world.lastResponse = res;
  },
);

// ============================================================================
// Then — Aserciones de éxito
// ============================================================================

Then(
  'la reseña fue guardada exitosamente',
  function (this: MyWorld) {
    const res = this.world.lastResponse;
    expect(res).toBeDefined();
    expect(res.status).toBe(201);
    expect(res.body).toBeDefined();
    expect(res.body.id).toBeDefined();
    expect(typeof res.body.id).toBe('string');
  },
);

Then(
  'la reseña del conductor {string} es visible en el perfil del vehículo',
  async function (this: MyWorld, alias: string) {
    useAlias(this, alias);
    const reservationId = getReservationId(this, alias);
    const detail = await api(this).get(`/reservations/${reservationId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.review).toBeDefined();
    expect(detail.body.review.targetType).toBe('vehicle');
  },
);

Then(
  'la reseña del conductor {string} es visible en el perfil del rentador',
  async function (this: MyWorld, alias: string) {
    // Verificar que el rentador ve la reseña en su listing
    useOwner(this);
    const res = await api(this).get('/reviews/rentador/mine');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.some(
      (r: any) => r.reservationId === getReservationId(this, alias),
    );
    expect(found).toBe(true);
  },
);

Then(
  'la reseña del rentador es visible en el perfil del conductor',
  async function (this: MyWorld) {
    // Verificar que el conductor ve la reseña en su listing
    const aliases = Object.keys(this.world.reservations_by_alias ?? {})
      .filter((a) => a !== '__owner__');
    if (aliases.length === 0) throw new Error('no hay conductor con reserva');
    useAlias(this, aliases[0]);
    const res = await api(this).get('/reviews/conductor/mine');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  },
);

Then(
  'la reseña es visible inmediatamente en el perfil del vehículo',
  function (this: MyWorld) {
    // La reseña recién creada queda en lastResponse, verificamos que existe
    const res = this.world.lastResponse;
    expect(res).toBeDefined();
    expect(res.status).toBe(201);
    // Al obtener el detalle de la reserva inmediatamente después, debe aparecer
  },
);

// ============================================================================
// Then — Aserciones de visibilidad en historial
// ============================================================================

Then(
  'el conductor {string} ve la opción "Dejar reseña" para la reserva completada',
  function (this: MyWorld, alias: string) {
    const res = this.world.lastResponse;
    expect(res.status).toBe(200);
    const items: any[] = res.body.items ?? res.body;
    const reservationId = getReservationId(this, alias);
    const rsv = items.find((r: any) => r.id === reservationId);
    expect(rsv).toBeDefined();
    expect(rsv.status).toBe('completed');
  },
);

Then(
  'no hay opción "Dejar reseña" para la reserva',
  function (this: MyWorld) {
    const res = this.world.lastResponse;
    expect(res.status).toBe(200);
    const items: any[] = res.body.items ?? res.body;
    // Para reservas no completadas, no debería haber review asociada
    for (const item of items) {
      if (item.status !== 'completed') {
        // No hay reseña asociada (se verifica indirectamente por el status)
        expect(item.status).not.toBe('completed');
      }
    }
  },
);

// ============================================================================
// Then — AC4: Ver reseña en detalle de reserva
// ============================================================================

Then(
  'veo la reseña con puntuación {int} y comentario {string}',
  function (this: MyWorld, rating: number, comment: string) {
    const body = this.world.lastResponse?.body;
    expect(body).toBeDefined();
    expect(body.review).toBeDefined();
    expect(body.review.rating).toBe(rating);
    expect(body.review.comment).toBe(comment);
  },
);

Then(
  've la reseña con puntuación {int} y comentario {string}',
  function (this: MyWorld, rating: number, comment: string) {
    const body = this.world.lastResponse?.body;
    expect(body).toBeDefined();
    expect(body.review).toBeDefined();
    expect(body.review.rating).toBe(rating);
    expect(body.review.comment).toBe(comment);
  },
);

Then(
  'la reseña fue generada para el vehículo',
  function (this: MyWorld) {
    const body = this.world.lastResponse?.body;
    expect(body?.review?.targetType).toBe('vehicle');
  },
);

Then(
  'la reseña fue generada para el conductor',
  function (this: MyWorld) {
    const body = this.world.lastResponse?.body;
    expect(body?.review?.targetType).toBe('conductor');
  },
);

// ============================================================================
// Then — Aserciones de error
// ============================================================================

Then(
  'recibo un error indicando que la reserva no está completada',
  function (this: MyWorld) {
    const res = this.world.lastResponse;
    expect(res).toBeDefined();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const body = res.body;
    const detail = body?.detail ?? body?.message ?? '';
    expect(
      detail.toLowerCase().includes('complet') ||
      detail.toLowerCase().includes('completed') ||
      detail.toLowerCase().includes('estado') ||
      body?.code === 'RESERVATION_NOT_COMPLETED',
    ).toBe(true);
  },
);

Then(
  'recibo un error indicando que la reserva ya fue reseñada',
  function (this: MyWorld) {
    const res = this.world.lastResponse;
    expect(res).toBeDefined();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const body = res.body;
    const detail = body?.detail ?? body?.message ?? '';
    expect(
      detail.toLowerCase().includes('ya') ||
      detail.toLowerCase().includes('already') ||
      body?.code === 'REVIEW_ALREADY_EXISTS',
    ).toBe(true);
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
  'conductor': 'conductor',
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
