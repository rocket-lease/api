import request from 'supertest';
import { MyWorld } from './world';

export function api(world: MyWorld) {
  const server = world.app.getHttpServer();
  const proxy: Record<string, (...args: unknown[]) => Promise<any>> = {};
  for (const method of ['get', 'post', 'patch', 'delete', 'put']) {
    proxy[method] = async (url: string, body?: any) => {
      let req = request(server)[method](url);
      if (world.world.access_token) {
        req = req.set('Authorization', `Bearer ${world.world.access_token}`);
      }
      if (body) {
        req = req.send(body);
      }
      const response = await req;
      world.world.lastResponse = response;
      world.log(
        JSON.stringify(
          { method, url, status: response.status, body: response.body },
          null,
          2,
        ),
      );
      return response;
    };
  }

  proxy['upload'] = async (
    url: string,
    fieldName: string,
    buffer: Buffer,
    filename: string,
  ) => {
    let req = request(server).post(url);
    if (world.world.access_token) {
      req = req.set('Authorization', `Bearer ${world.world.access_token}`);
    }
    req = req.attach(fieldName, buffer, filename);
    const response = await req;
    world.world.lastResponse = response;
    world.log(
      JSON.stringify(
        { method: 'upload', url, status: response.status, body: response.body },
        null,
        2,
      ),
    );
    return response;
  };

  return proxy;
}
