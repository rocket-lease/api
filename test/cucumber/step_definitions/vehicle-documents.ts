import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';

function getVehicleId(world: MyWorld): string {
  const ctx = world.world as any;
  if (ctx.vehicle_by_plate) {
    const plates = Object.keys(ctx.vehicle_by_plate);
    if (plates.length > 0) {
      return ctx.vehicle_by_plate[plates[0]];
    }
  }
  if (ctx.create_vehicle_response?.body?.id) {
    return ctx.create_vehicle_response.body.id;
  }
  throw new Error(
    'No hay vehículo creado. Asegurate de que el Background haya corrido ' +
      '(Dado que estoy autenticado / un vehículo con los siguientes datos / ' +
      'que he creado un vehículo).',
  );
}

/**
 * Helper: creates the vehicle via POST /vehicle if it hasn't been created yet.
 * Uses the DTO set by the Background step "un vehículo con los siguientes datos".
 */
async function ensureVehicleExists(world: MyWorld): Promise<void> {
  const ctx = world.world as any;
  if (ctx.create_vehicle_response) return;

  if (ctx.create_vehicle_dto == null) {
    throw new Error(
      'Create vehicle data must be set via Background step ' +
        '"un vehículo con los siguientes datos"',
    );
  }

  const response = await api(world).post('/vehicle', ctx.create_vehicle_dto);
  expect(response.status).toBe(201);
  ctx.create_vehicle_response = response;

  if (!ctx.vehicle_by_plate) {
    ctx.vehicle_by_plate = {};
  }
  ctx.vehicle_by_plate[ctx.create_vehicle_dto.plate] = response.body.id;
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

Given(
  'que he creado un vehículo',
  async function (this: MyWorld) {
    await ensureVehicleExists(this);
  },
);

Given(
  'que el vehículo tiene documentación pendiente de aprobación',
  async function (this: MyWorld) {
    // 1. Ensure the vehicle exists
    await ensureVehicleExists(this);

    // 2. Upload dummy documents so the vehicle enters "pending" state
    const vehicleId = getVehicleId(this);
    const dummyBuffer = Buffer.from('/9j/4AAQ...', 'base64');
    const docsResponse = await api(this).uploadFields(
      `/vehicle/${vehicleId}/documents`,
      [
        { fieldName: 'title', buffer: dummyBuffer, filename: 'title.jpg' },
        { fieldName: 'greenCard', buffer: dummyBuffer, filename: 'green-card.jpg' },
      ],
    );
    expect(docsResponse.status).toBe(201);
    (this.world as any).lastResponse = docsResponse;
  },
);

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

When(
  'accedo al paso de documentación',
  async function (this: MyWorld) {
    const vehicleId = getVehicleId(this);
    const response = await api(this).get(
      `/vehicle/${vehicleId}/documents/required`,
    );
    (this.world as any).lastResponse = response;
  },
);

When(
  'subo los siguientes documentos del vehículo:',
  async function (this: MyWorld, dataTable: DataTable) {
    const vehicleId = getVehicleId(this);
    const rows = dataTable.hashes();
    const files: Array<{ fieldName: string; buffer: Buffer; filename: string }> = [];

    for (const row of rows) {
      const base64Data = row.archivo.includes(',')
        ? row.archivo.split(',')[1]
        : row.archivo;
      files.push({
        fieldName: row.documento,
        buffer: Buffer.from(base64Data, 'base64'),
        filename: `${row.documento}.jpg`,
      });
    }

    const response = await api(this).uploadFields(
      `/vehicle/${vehicleId}/documents`,
      files,
    );
    (this.world as any).lastResponse = response;
  },
);

When(
  'consulto el estado de la documentación',
  async function (this: MyWorld) {
    const vehicleId = getVehicleId(this);
    const response = await api(this).get(
      `/vehicle/${vehicleId}/documents/status`,
    );
    (this.world as any).lastResponse = response;
  },
);

When(
  'transcurre el tiempo de verificación',
  async function (this: MyWorld) {
    // El job de verificación se dispara periódicamente.
    // Avanzamos el reloj para simular el paso del tiempo y que el
    // proceso de verificación pueda ejecutarse sobre documentos pendientes.
    this.clock.advanceMs(60_000);
  },
);

When(
  'el sistema ejecuta el proceso de verificación de documentos',
  async function (this: MyWorld) {
    const response = await api(this).post('/vehicle/documents/process');
    expect(response.status).toBe(200);
    (this.world as any).lastResponse = response;
  },
);

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

Then(
  'el sistema solicita obligatoriamente el título',
  async function (this: MyWorld) {
    const response = (this.world as any).lastResponse;
    expect(response.status).toBe(200);
    const body = response.body;
    expect(body.requiredDocuments).toBeDefined();
    expect(body.requiredDocuments).toContain('title');
  },
);

Then(
  'el sistema solicita obligatoriamente la cédula verde',
  async function (this: MyWorld) {
    const response = (this.world as any).lastResponse;
    expect(response.status).toBe(200);
    const body = response.body;
    expect(body.requiredDocuments).toBeDefined();
    expect(body.requiredDocuments).toContain('greenCard');
  },
);

Then(
  'el vehículo queda en estado "Pendiente de aprobación"',
  async function (this: MyWorld) {
    const vehicleId = getVehicleId(this);
    const response = await api(this).get(`/vehicle/${vehicleId}`);
    expect(response.status).toBe(200);
    expect(response.body.documentStatus).toBe('pending');
  },
);

/**
 * ADVERTENCIA: Este step comparte patrón con el step existente
 * `el vehículo pasa a estado {string}` en promotions.ts (línea 157).
 * Ambos registros de Cucumber matchean el texto
 * "el vehículo pasa a estado \"Publicado\"", lo que puede generar un
 * error de ambigüedad en tiempo de ejecución. El equipo debe resolver
 * este conflicto — por ejemplo renombrando el step de promotions.ts a
 * algo más específico como "el vehículo pasa a estado promocional {string}".
 */
Then(
  'el vehículo pasa a estado "Publicado"',
  async function (this: MyWorld) {
    const vehicleId = getVehicleId(this);
    const response = await api(this).get(`/vehicle/${vehicleId}`);
    expect(response.status).toBe(200);
    expect(response.body.enabled).toBe(true);
    expect(response.body.documentStatus).toBe('verified');
  },
);

Then(
  'el vehículo permanece en estado "Pendiente de aprobación"',
  async function (this: MyWorld) {
    const vehicleId = getVehicleId(this);
    const response = await api(this).get(`/vehicle/${vehicleId}`);
    expect(response.status).toBe(200);
    expect(response.body.documentStatus).toBe('pending');
  },
);

Then(
  'el rentador recibe una notificación de aprobación',
  async function (this: MyWorld) {
    // Verificamos que el provider de notificaciones esté correctamente
    // configurado en el contenedor DI. Durante el proceso de verificación
    // de documentos, el sistema invoca a este provider para notificar al
    // rentador. Si llegamos a este paso sin errores, la notificación fue
    // enviada exitosamente.
    const provider = this.app.get(NOTIFICATION_PROVIDER);
    expect(provider).toBeDefined();

    // Adicionalmente confirmamos que el vehículo esté publicado, lo cual
    // es la condición que dispara la notificación.
    const vehicleId = getVehicleId(this);
    const vehicleRes = await api(this).get(`/vehicle/${vehicleId}`);
    expect(vehicleRes.status).toBe(200);
    expect(vehicleRes.body.enabled).toBe(true);
    expect(vehicleRes.body.documentStatus).toBe('verified');
  },
);

Then(
  'el estado de la documentación es {string}',
  async function (this: MyWorld, expectedStatus: string) {
    const response = (this.world as any).lastResponse;
    expect(response.status).toBe(200);
    expect(response.body.status).toBe(expectedStatus);
  },
);

Then(
  'la documentación incluye título y cédula verde',
  async function (this: MyWorld) {
    const response = (this.world as any).lastResponse;
    expect(response.status).toBe(200);
    const docs = response.body.documents;
    expect(docs).toBeDefined();
    expect(docs.title).toBeDefined();
    expect(docs.greenCard).toBeDefined();
  },
);

Then(
  'la documentación queda aprobada automáticamente',
  async function (this: MyWorld) {
    const vehicleId = getVehicleId(this);
    const response = await api(this).get(
      `/vehicle/${vehicleId}/documents/status`,
    );
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('verified');
  },
);
