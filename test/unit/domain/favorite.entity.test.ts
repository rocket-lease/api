import { Favorite } from '@/domain/entities/favorite.entity';
import { randomUUID } from 'crypto';

const validId = randomUUID();
const validConductorId = randomUUID();
const validVehicleId = randomUUID();

describe('Favorite Entity', () => {
  it('crea entidad válida con todos los campos', () => {
    const fav = new Favorite(
      validId,
      validConductorId,
      validVehicleId,
      new Date(),
    );
    expect(fav.id).toBe(validId);
    expect(fav.conductorId).toBe(validConductorId);
    expect(fav.vehicleId).toBe(validVehicleId);
  });

  it('genera UUID propio cuando no se pasa id', () => {
    const fav = new Favorite(undefined, validConductorId, validVehicleId);
    expect(fav.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('asigna createdAt por defecto cuando no se pasa', () => {
    const before = new Date();
    const fav = new Favorite(undefined, validConductorId, validVehicleId);
    const after = new Date();
    expect(fav.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(fav.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('lanza error de validación si conductorId no es UUID', () => {
    expect(() => new Favorite(validId, 'no-es-uuid', validVehicleId)).toThrow(
      'Validation error:',
    );
  });

  it('lanza error de validación si vehicleId no es UUID', () => {
    expect(() => new Favorite(validId, validConductorId, 'no-es-uuid')).toThrow(
      'Validation error:',
    );
  });

  it('lanza error de validación si id no es UUID', () => {
    expect(
      () => new Favorite('id-invalido', validConductorId, validVehicleId),
    ).toThrow('Validation error:');
  });
});
