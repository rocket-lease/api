import { Vehicle } from '@/domain/entities/vehicle.entity';
import { randomUUID } from 'crypto';

const buildVehicle = (overrides: Partial<Record<string, any>> = {}) => {
  const base = {
    id: randomUUID(),
    ownerId: randomUUID(),
    plate: 'ALC743',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    passengers: 5,
    trunkLiters: 400,
    transmission: 'Manual' as const,
    isAccessible: false,
    enabled: true,
    photos: ['https://example.com/photo.jpg'],
    characteristics: [] as Array<any>,
    color: 'Red',
    mileage: 15000,
    basePrice: 25000,
    description: 'A reliable sedan',
    province: 'Buenos Aires',
    city: 'La Plata',
    availableFrom: '2026-06-01',
    ...overrides,
  };
  return new Vehicle(
    base.id,
    base.ownerId,
    base.plate,
    base.brand,
    base.model,
    base.year,
    base.passengers,
    base.trunkLiters,
    base.transmission,
    base.isAccessible,
    base.enabled,
    base.photos,
    base.characteristics,
    base.color,
    base.mileage,
    base.basePrice,
    base.description,
    base.province,
    base.city,
    base.availableFrom,
  );
};

describe('Vehicle Entity', () => {
  it('should throw if plate is null', () => {
    expect(() => buildVehicle({ plate: null })).toThrow('Validation error:');
  });

  it('should throw if brand is null', () => {
    expect(() => buildVehicle({ brand: null })).toThrow('Validation error:');
  });

  it('should throw if model is null', () => {
    expect(() => buildVehicle({ model: null })).toThrow('Validation error:');
  });

  it('should throw if color is null', () => {
    expect(() => buildVehicle({ color: null })).toThrow('Validation error:');
  });

  it('should throw if mileage is negative', () => {
    expect(() => buildVehicle({ mileage: -1 })).toThrow('Validation error:');
  });

  it('should throw if base price is zero', () => {
    expect(() => buildVehicle({ basePrice: 0 })).toThrow('Validation error:');
  });

  it('should throw if base price is negative', () => {
    expect(() => buildVehicle({ basePrice: -1 })).toThrow('Validation error:');
  });
});
