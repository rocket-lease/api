import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from 'expect';
import { api } from '../support/http-client';
import { MyWorld } from '../support/world';
import { Characteristic } from '@rocket-lease/contracts';

const CHARACTERISTIC_MAP: Record<string, Characteristic> = {
  gps: 'GPS',
  'silla para bebe': 'BABY_SEAT',
  'silla para bebé': 'BABY_SEAT',
  'techo solar': 'SUNROOF',
  'apto para mascotas': 'PET_FRIENDLY',
  mascotas: 'PET_FRIENDLY',
  wifi: 'WIFI',
  'cargador usb': 'USB_CHARGER',
  'cable aux': 'AUX_CABLE',
  bluetooth: 'BLUETOOTH',
};

const parseCharacteristics = (raw: string): Characteristic[] => {
  const items = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return items.map((item) => {
    const mapped = CHARACTERISTIC_MAP[item];
    if (!mapped) {
      throw new Error(`Caracteristica no soportada: ${item}`);
    }
    return mapped;
  });
};

const buildVehicleDto = (plate: string) => ({
  plate,
  brand: 'Ford',
  model: 'Focus',
  year: 2023,
  passengers: 5,
  trunkLiters: 450,
  transmission: 'Manual',
  isAccessible: false,
  photos: ['https://example.com/photo1.jpg'],
  color: 'Gris',
  mileage: 12000,
  basePrice: 35000000,
  description: 'Vehiculo para pruebas',
  province: 'B',
  city: 'CABA',
  availableFrom: '2026-06-01',
});

Given(
  'vehiculos con las siguientes caracteristicas:',
  async function (this: MyWorld, dataTable: DataTable) {
    const rows = dataTable.hashes();
    const created: Array<{
      id: string;
      plate: string;
      characteristics: Characteristic[];
    }> = [];

    for (const row of rows) {
      const plate = row['patente'];
      const characteristics = parseCharacteristics(
        row['caracteristicas'] ?? '',
      );
      const createRes = await api(this).post(
        '/vehicle',
        buildVehicleDto(plate),
      );
      expect(createRes.status).toBe(201);

      const vehicleId = createRes.body.id;
      const updateRes = await api(this).patch(`/vehicle/${vehicleId}`, {
        characteristics,
      });
      expect(updateRes.status).toBe(200);

      created.push({ id: vehicleId, plate, characteristics });
    }

    this.world.characteristics_vehicles = created;
    this.world.expected_filter_plates = created
      .filter((v) => v.characteristics.includes('GPS'))
      .map((v) => v.plate);
  },
);

Given(
  'un vehiculo con las caracteristicas {string}',
  async function (this: MyWorld, raw: string) {
    const characteristics = parseCharacteristics(raw);
    const createRes = await api(this).post(
      '/vehicle',
      buildVehicleDto(`AA${Date.now()}AA`),
    );
    expect(createRes.status).toBe(201);

    this.world.create_vehicle_response = createRes;
    this.world.current_characteristics = characteristics;

    const updateRes = await api(this).patch(`/vehicle/${createRes.body.id}`, {
      characteristics,
    });
    expect(updateRes.status).toBe(200);
  },
);

When(
  'actualizo las caracteristicas del vehiculo a {string}',
  async function (this: MyWorld, raw: string) {
    const characteristics = parseCharacteristics(raw);
    this.world.current_characteristics = characteristics;
    const vehicleId = this.world.create_vehicle_response.body.id;
    this.world.update_vehicle_response = await api(this).patch(
      `/vehicle/${vehicleId}`,
      {
        characteristics,
      },
    );
  },
);

When(
  'elimino la caracteristica {string}',
  async function (this: MyWorld, raw: string) {
    const toRemove = parseCharacteristics(raw)[0];
    const vehicleId = this.world.create_vehicle_response.body.id;
    const current: Characteristic[] = this.world.current_characteristics ?? [];
    const next = current.filter((item) => item !== toRemove);
    this.world.current_characteristics = next;

    this.world.update_vehicle_response = await api(this).patch(
      `/vehicle/${vehicleId}`,
      {
        characteristics: next,
      },
    );
  },
);

When(
  'filtro vehiculos por {string}',
  async function (this: MyWorld, raw: string) {
    const characteristic = parseCharacteristics(raw)[0];
    this.world.filter_characteristic = characteristic;
    this.world.filter_response = await api(this).get(
      `/vehicle?characteristics=${characteristic}`,
    );
  },
);

Then(
  'el vehiculo queda con las caracteristicas {string}',
  async function (this: MyWorld, raw: string) {
    expect(this.world.update_vehicle_response.status).toBe(200);
    const expected = parseCharacteristics(raw);
    const vehicleId = this.world.create_vehicle_response.body.id;

    const res = await api(this).get(`/vehicle/${vehicleId}`);
    expect(res.status).toBe(200);
    expect(res.body.characteristics).toEqual(expect.arrayContaining(expected));
  },
);

Then(
  'solo aparecen vehiculos con la caracteristica {string}',
  function (this: MyWorld, raw: string) {
    const expectedCharacteristic = parseCharacteristics(raw)[0];
    const response = this.world.filter_response;
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    for (const vehicle of response.body) {
      expect(vehicle.characteristics).toEqual(
        expect.arrayContaining([expectedCharacteristic]),
      );
    }

    if (Array.isArray(this.world.expected_filter_plates)) {
      const plates = response.body.map((v: any) => v.plate);
      for (const expectedPlate of this.world.expected_filter_plates) {
        expect(plates).toContain(expectedPlate);
      }
    }
  },
);

Then(
  'el vehiculo no tiene la caracteristica {string}',
  async function (this: MyWorld, raw: string) {
    const removed = parseCharacteristics(raw)[0];
    const vehicleId = this.world.create_vehicle_response.body.id;

    const res = await api(this).get(`/vehicle/${vehicleId}`);
    expect(res.status).toBe(200);
    expect(res.body.characteristics).not.toContain(removed);
  },
);

Then(
  'el vehiculo no aparece en el catalogo filtrado por {string}',
  async function (this: MyWorld, raw: string) {
    const characteristic = parseCharacteristics(raw)[0];
    const res = await api(this).get(
      `/vehicle?characteristics=${characteristic}`,
    );
    expect(res.status).toBe(200);
    const plates = res.body.map((v: any) => v.plate);
    const currentPlate = this.world.create_vehicle_response.body.plate;
    expect(plates).not.toContain(currentPlate);
  },
);
