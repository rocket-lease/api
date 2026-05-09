import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import request from 'supertest';
import { expect } from 'expect';

Given('un vehículo con los siguientes datos:', async function (this: MyWorld, dataTable: DataTable) {
    const data = dataTable.hashes()[0];
    this.world.create_vehicle_dto = data // TODO: transformar a DTO
});

When('envio el formulario de creacion de vehiculo', async function(this: MyWorld) {
    if (this.world.create_vehicle_dto == null) {
        throw Error('Create vehicle data must be set');
    }
    this.world.create_vehicle_response = await request(this.app.getHttpServer())
        .post("/vehicle")
        .send(this.world.create_vehicle_dto);
});

Then("el vehículo aparece en 'Mis vehículos' en estado pendiente de aprobación", async function(this: MyWorld) {
    const response = this.world.create_vehicle_response;
    expect(response.status).toBe(201);
    const created_vehicle = response.body
    expect(created_vehicle.status).toBe('PENDING_APPROVAL'); // TODO: cambiar al que definamos
    const my_vehicles_response = await request(this.app.getHttpServer())
        .get(`/vehicle`)
    expect(my_vehicles_response.body).toContain(created_vehicle.id)
});
