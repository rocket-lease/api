import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import { expect } from 'expect';
import { api } from '../support/http-client';

const mapTableToDto = (rawData: any) => ({
  plate: rawData['patente'],
  brand: rawData['marca'],
  model: rawData['modelo'],
  color: rawData['color'],
  mileage: Number(rawData['kilometraje']),
  basePrice: Number(rawData['precio base']),
  description: rawData['descripción'] || null,
  year: Number(rawData['año']) || 2024,
  passengers: Number(rawData['pasajeros']) || 5,
  trunkLiters: Number(rawData['baul']) || 400,
  transmission: rawData['tipo de transmisión'] || 'Manual',
  isAccessible: rawData['accesible'] === 'Sí',
  photos: ['https://example.com/photo1.jpg'],
  province: rawData['provincia'] || 'B',
  city: rawData['ciudad'] || 'CABA',
  availableFrom: rawData['disponible desde'] || '2026-06-01',
});

const COLUMN_MAP: Record<string, string> = {
  patente: 'plate',
  marca: 'brand',
  modelo: 'model',
  color: 'color',
  kilometraje: 'mileage',
  'precio base': 'basePrice',
  descripción: 'description',
  año: 'year',
  pasajeros: 'passengers',
  baul: 'trunkLiters',
  'tipo de transmisión': 'transmission',
  accesible: 'isAccessible',
  fotos: 'photos',
  provincia: 'province',
  ciudad: 'city',
  'disponible desde': 'availableFrom',
};

const rawToUpdateDto = (rawData: Record<string, string>) => {
  const dto: Record<string, any> = {};
  if ('color' in rawData) dto.color = rawData['color'];
  if ('patente' in rawData) dto.plate = rawData['patente'];
  if ('kilometraje' in rawData) dto.mileage = Number(rawData['kilometraje']);
  if ('precio base' in rawData) dto.basePrice = Number(rawData['precio base']);
  if ('descripción' in rawData) dto.description = rawData['descripción'];
  if ('fotos' in rawData)
    dto.photos = rawData['fotos'].split(',').map((s: string) => s.trim());
  if ('accesible' in rawData) dto.isAccessible = rawData['accesible'] === 'Sí';
  if ('provincia' in rawData) dto.province = rawData['provincia'];
  if ('ciudad' in rawData) dto.city = rawData['ciudad'];
  if ('disponible desde' in rawData)
    dto.availableFrom = rawData['disponible desde'];
  return dto;
};

Given(
  'un vehículo con los siguientes datos:',
  async function (this: MyWorld, dataTable: DataTable) {
    const rawData = dataTable.hashes()[0];
    this.world.create_vehicle_dto = mapTableToDto(rawData);
  },
);

Given('el vehiculo ya esta publicado', async function (this: MyWorld) {
  if (this.world.create_vehicle_dto == null) {
    throw Error('Create vehicle data must be set');
  }
  this.world.create_vehicle_response = await api(this).post(
    '/vehicle',
    this.world.create_vehicle_dto,
  );
  console.log(
    'Create vehicle response: ',
    this.world.create_vehicle_response.body,
  );
  expect(this.world.create_vehicle_response.status).toBe(201);
});



Given('el vehículo esta deshabilitado', async function (this: MyWorld) {
  const response = await api(this).patch(
    `/vehicle/${this.world.create_vehicle_response.body.id}`,
    { enabled: false },
  );
  expect(response.status).toBe(200);
});

When(
  'actualizo la información de un vehículo con los siguientes datos:',
  async function (this: MyWorld, dataTable: DataTable) {
    const rawData = dataTable.hashes()[0];
    this.world.update_vehicle_dto = rawToUpdateDto(rawData);
    this.world.update_vehicle_response = await api(this).patch(
      `/vehicle/${this.world.create_vehicle_response.body.id}`,
      this.world.update_vehicle_dto,
    );
  },
);

When(
  'envio el formulario de creacion de vehiculo',
  async function (this: MyWorld) {
    if (this.world.create_vehicle_dto == null) {
      throw Error('Create vehicle data must be set');
    }
    this.world.create_vehicle_response = await api(this).post(
      '/vehicle',
      this.world.create_vehicle_dto,
    );
  },
);

When('elimino el vehículo', async function (this: MyWorld) {
  const vehicleId = this.world.create_vehicle_response.body.id;
  this.world.delete_vehicle_response = await api(this).delete(
    `/vehicle/${vehicleId}`,
  );
});

When('habilito el vehículo', async function (this: MyWorld) {
  const vehicleId = this.world.create_vehicle_response.body.id;
  this.world.enable_vehicle_response = await api(this).patch(
    `/vehicle/${vehicleId}`,
    { enabled: true },
  );
});

When('deshabilito el vehículo', async function (this: MyWorld) {
  const vehicleId = this.world.create_vehicle_response.body.id;
  this.world.update_vehicle_response = await api(this).patch(
    `/vehicle/${vehicleId}`,
    { enabled: false },
  );
  expect(this.world.update_vehicle_response.status).toBe(200);
});

Then('el vehículo se deshabilita', async function (this: MyWorld) {
  const vehicleId = this.world.create_vehicle_response.body.id;
  const res = await api(this).get(`/vehicle/${vehicleId}`);
  expect(res.status).toBe(200);
  expect(res.body.enabled).toBe(false);
});

Then('el vehículo es eliminado', function (this: MyWorld) {
  expect(this.world.delete_vehicle_response.status).toBe(200);
});

Then(
  "el vehículo no aparece en 'Mis vehículos'",
  async function (this: MyWorld) {
    const my_vehicles_response = await api(this).get(`/vehicle/mine`);
    expect(my_vehicles_response.status).toBe(200);
    const plate = this.world.create_vehicle_dto.plate;
    const vehicle_exists = my_vehicles_response.body.some(
      (v: any) => v.plate === plate,
    );
    expect(vehicle_exists).toBe(false);
  },
);

Then('el vehiculo es publicado', async function (this: MyWorld) {
  console.log(
    'el vehiculo es publicado: ',
    this.world.create_vehicle_response.body,
  );
  const response = this.world.create_vehicle_response;
  expect(response.status).toBe(201);
});

Then('el vehiculo no se publica', async function (this: MyWorld) {
  const status = this.world.create_vehicle_response.status;
  expect(status).toBeGreaterThanOrEqual(400);
  expect(status).toBeLessThan(500);
});

Then("el vehículo aparece en 'Mis vehículos'", async function (this: MyWorld) {
  const my_vehicles_response = await api(this).get(`/vehicle/mine`);
  expect(my_vehicles_response.status).toBe(200);

  const plate_to_find = this.world.create_vehicle_dto.plate;
  const vehicle_exists = my_vehicles_response.body.some(
    (v: any) => v.plate === plate_to_find,
  );
  expect(vehicle_exists).toBe(true);
});

Then('el vehiculo queda actualizado', async function (this: MyWorld) {
  const response = this.world.update_vehicle_response;
  expect(response.status).toBe(200);

  const vehicleId = this.world.create_vehicle_response.body.id;
  const get_vehicle_response = await api(this).get(`/vehicle/${vehicleId}`);
  expect(get_vehicle_response.status).toBe(200);

  const updatedData = get_vehicle_response.body;
  const expectedData = this.world.update_vehicle_dto;

  expect(updatedData.mileage).toBe(expectedData.mileage);
  expect(updatedData.basePrice).toBe(expectedData.basePrice);
  expect(updatedData.color).toBe(expectedData.color);
  expect(updatedData.description).toBe(expectedData.description);
  expect(updatedData.plate).toBe(this.world.create_vehicle_dto.plate);
});

Then('el vehiculo no se actualiza', async function (this: MyWorld) {
  const vehicleId = this.world.create_vehicle_response.body.id;
  const res = await api(this).get(`/vehicle/${vehicleId}`);
  expect(res.status).toBe(200);
  const original = this.world.create_vehicle_dto;
  expect(res.body.plate).toBe(original.plate);
  expect(res.body.mileage).toBe(original.mileage);
  expect(res.body.color).toBe(original.color);
});

Then('el vehículo aparece en el catálogo', async function (this: MyWorld) {
  const vehicleId = this.world.create_vehicle_response.body.id;
  const res = await api(this).get(`/vehicle/${vehicleId}`);
  expect(res.status).toBe(200);
});

Then(
  'el sistema indica que no se puede modificar el campo {string}',
  async function (this: MyWorld, campo: string) {
    expect(this.world.update_vehicle_response.status).toBe(400);
    const field = COLUMN_MAP[campo.toLowerCase()];
    expect(
      this.world.update_vehicle_response.body.message?.toLowerCase(),
    ).toContain(field);
  },
);

Then(
  'el sistema indica que el vehículo ya existe',
  async function (this: MyWorld) {
    expect(this.world.create_vehicle_response.status).toBe(409);
    expect(this.world.create_vehicle_response.body.message).toContain(
      `vehicle with id ${this.world.create_vehicle_dto.plate} already exists`,
    );
  },
);

Then(
  'el sistema indica que faltan campos obligatorios',
  async function (this: MyWorld) {
    const response = this.world.create_vehicle_response;
    expect(response.status).toBe(400);
    expect(response.body.message.toLowerCase()).toContain('cannot be empty');
  },
);

Then(
  'el sistema muestra un error de validación',
  async function (this: MyWorld) {
    const response = this.world.create_vehicle_response;
    expect(response.status).toBe(400);
    expect(response.body.message.toLowerCase()).toContain('validation error:');
  },
);

Then('el vehículo no aparece en el catálogo', async function (this: MyWorld) {
  const res = await api(this).get(`/vehicle`);
  expect(res.status).toBe(200);
  const plate = this.world.create_vehicle_dto.plate;
  const found = res.body.some((v: any) => v.plate === plate);
  expect(found).toBe(false);
});
