import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import request from 'supertest';
import { expect } from 'expect';

Given('un vehículo con los siguientes datos:', async function (this: MyWorld, dataTable: DataTable) {
    const rawData = dataTable.hashes()[0];
    // TODO: transformar a DTO
    this.world.create_vehicle_dto = {
        plate: rawData['patente'],
        brand: rawData['marca'],
        model: rawData['modelo'],
        color: rawData['color'],
        mileage: Number(rawData['kilometraje']),
        basePrice: Number(rawData['precio base']),
        description: rawData['descripción'],
    };
});

Given('el vehiculo ya esta publicado', async function (this: MyWorld) {
    if (this.world.create_vehicle_dto == null) {
        throw Error('Create vehicle data must be set');
    }
    const create_vehicle_response = await request(this.app.getHttpServer())
        .post("/vehicle")
        .send(this.world.create_vehicle_dto);
    expect(create_vehicle_response.status).toBe(201);
});


When('envio el formulario de creacion de vehiculo', async function(this: MyWorld) {
    if (this.world.create_vehicle_dto == null) {
        throw Error('Create vehicle data must be set');
    }
    this.world.create_vehicle_response = await request(this.app.getHttpServer())
        .post("/vehicle")
        .send(this.world.create_vehicle_dto);
});

Then("el vehiculo es publicado", async function(this: MyWorld) {
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
    expect(my_vehicles_response.status).toBe(200);

    const plate_to_find = this.world.create_vehicle_dto.plate
    const vehicle_exists = my_vehicles_response.body.some((v: any) => 
        v.plate === plate_to_find
    );
    expect(vehicle_exists).toBe(true);
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
