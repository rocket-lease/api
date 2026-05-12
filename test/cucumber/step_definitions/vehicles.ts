import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import request from 'supertest';
import { expect } from 'expect';

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
    photos: ["https://example.com/photo1.jpg"]
});

Given('un vehículo con los siguientes datos:', async function (this: MyWorld, dataTable: DataTable) {
    const rawData = dataTable.hashes()[0];
    this.world.create_vehicle_dto = mapTableToDto(rawData);
});

Given('el vehiculo ya esta publicado', async function (this: MyWorld) {
    if (this.world.create_vehicle_dto == null) {
        throw Error('Create vehicle data must be set');
    }
    this.world.create_vehicle_response = await request(this.app.getHttpServer())
        .post("/vehicle")
        .set('Authorization', `Bearer ${this.world.access_token}`)
        .send(this.world.create_vehicle_dto);
    console.log("Create vehicle response: ", this.world.create_vehicle_response.body);
    expect(this.world.create_vehicle_response.status).toBe(201);
});

When('actualizo la información de un vehículo con los siguientes datos:', async function(this: MyWorld, dataTable: DataTable) {
    const rawData = dataTable.hashes()[0];
    this.world.update_vehicle_dto = mapTableToDto(rawData);
    this.world.update_vehicle_response = await request(this.app.getHttpServer())
        .patch(`/vehicle/${this.world.create_vehicle_response.body.id}`)
        .set('Authorization', `Bearer ${this.world.access_token}`)
        .send(this.world.update_vehicle_dto);
});

When('envio el formulario de creacion de vehiculo', async function(this: MyWorld) {
    if (this.world.create_vehicle_dto == null) {
        throw Error('Create vehicle data must be set');
    }
    this.world.create_vehicle_response = await request(this.app.getHttpServer())
        .post("/vehicle")
        .set('Authorization', `Bearer ${this.world.access_token}`)
        .send(this.world.create_vehicle_dto);
});

When('elimino el vehículo', async function(this: MyWorld) {
    const vehicleId = this.world.create_vehicle_response.body.id;
    this.world.delete_vehicle_response = await request(this.app.getHttpServer())
        .delete(`/vehicle/${vehicleId}`)
        .set('Authorization', `Bearer ${this.world.access_token}`);
});

Then('el vehículo es eliminado', function(this: MyWorld) {
    expect(this.world.delete_vehicle_response.status).toBe(200);
});

Then("el vehículo no aparece en 'Mis vehículos'", async function(this: MyWorld) {
    const my_vehicles_response = await request(this.app.getHttpServer())
        .get(`/vehicle`)
        .set('Authorization', `Bearer ${this.world.access_token}`);
    expect(my_vehicles_response.status).toBe(200);
    const plate = this.world.create_vehicle_dto.plate;
    const vehicle_exists = my_vehicles_response.body.some((v: any) => v.plate === plate);
    expect(vehicle_exists).toBe(false);
});

Then("el vehiculo es publicado", async function(this: MyWorld) {
    console.log("el vehiculo es publicado: ", this.world.create_vehicle_response.body)
    const response = this.world.create_vehicle_response;
    expect(response.status).toBe(201);
});

Then("el vehiculo no se publica", async function(this: MyWorld) {
    const status = this.world.create_vehicle_response.status;
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
});

Then("el vehículo aparece en 'Mis vehículos'", async function(this: MyWorld) {
    const my_vehicles_response = await request(this.app.getHttpServer())
        .get(`/vehicle`)
        .set('Authorization', `Bearer ${this.world.access_token}`)
    expect(my_vehicles_response.status).toBe(200);

    const plate_to_find = this.world.create_vehicle_dto.plate
    const vehicle_exists = my_vehicles_response.body.some((v: any) => 
        v.plate === plate_to_find
    );
    expect(vehicle_exists).toBe(true);
});

Then("el vehiculo queda actualizado", async function(this: MyWorld) {
    const response = this.world.update_vehicle_response;
    expect(response.status).toBe(200);

    const vehicleId = this.world.create_vehicle_response.body.id;
    const get_vehicle_response = await request(this.app.getHttpServer())
        .get(`/vehicle/${vehicleId}`);
    expect(get_vehicle_response.status).toBe(200);

    const updatedData = get_vehicle_response.body;
    const expectedData = this.world.update_vehicle_dto;

    expect(updatedData.mileage).toBe(expectedData.mileage);
    expect(updatedData.basePrice).toBe(expectedData.basePrice);
    expect(updatedData.color).toBe(expectedData.color);
    expect(updatedData.description).toBe(expectedData.description);
    expect(updatedData.plate).toBe(this.world.create_vehicle_dto.plate);
});

Then("el sistema indica que el vehículo ya existe", async function(this: MyWorld) {
    expect(this.world.create_vehicle_response.status).toBe(409);
    expect(this.world.create_vehicle_response.body.message).toContain(`vehicle with id ${this.world.create_vehicle_dto.plate} already exists`);
});

Then("el sistema indica que faltan campos obligatorios", async function(this: MyWorld) {
    const response = this.world.create_vehicle_response;
    expect(response.status).toBe(400);
    expect(response.body.message.toLowerCase()).toContain("cannot be empty");
});

Then("el sistema muestra un error de validación", async function(this: MyWorld) {
    const response = this.world.create_vehicle_response;
    expect(response.status).toBe(400);
    expect(response.body.message.toLowerCase()).toContain("validation error:");
});
