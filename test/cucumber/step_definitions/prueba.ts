import { Given, When, Then } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import request from 'supertest';
import { expect } from 'expect';

Given('estoy probando cucumber', async function (this: MyWorld) {
    if (!this.app) {
        throw new Error('La aplicación de NestJS no se inició.');
    }
});

When('ejecuto un test', async function (this: MyWorld) {
    this.world.response = await request(this.app.getHttpServer()).get('/');
});

When('ejecuto un test que deberia fallar', async function (this: MyWorld) {
    this.world.response = await request(this.app.getHttpServer()).get('/endpoint-que-no-existe');
});

Then('da exitoso', function (this: MyWorld) {
    expect(this.world.response.status).toBe(200);
});

Then('da error', function (this: MyWorld) {
    expect(this.world.response.status).toBe(404); 
});
