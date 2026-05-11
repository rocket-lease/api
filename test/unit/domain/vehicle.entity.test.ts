import { Vehicle } from '@/domain/entities/vehicle.entity';

describe('Vehicle Entity', () => {
    it('should throw an error if plate is null', () => {
        expect(() => 
               new Vehicle(
                   undefined,
                   null as any,
                   'Toyota',
                   'Corolla',
                   'Red',
                   15000,
                   25000,
                   'A reliable sedan'
               )
              ).toThrow('Validation error:'); 
    });

    it('should throw an error if brand is null', () => {
        expect(() => 
               new Vehicle(
                   undefined,
                   'ALC743',
                   null as any,
                   'Corolla',
                   'Red',
                   15000,
                   25000,
                   'A reliable sedan'
               )
              ).toThrow('Validation error:'); 
    });

    it('should throw an error if model is null', () => {
        expect(() => 
               new Vehicle(
                   undefined,
                   'ALC743',
                   'Toyota',
                   null as any,
                   'Red',
                   15000,
                   25000,
                   'A reliable sedan'
               )
              ).toThrow('Validation error:'); 
    });

    it('should throw an error if color is null', () => {
        expect(() => 
               new Vehicle(
                   undefined,
                   'ALC743',
                   'Toyota',
                   'Corolla',
                   null as any,
                   15000,
                   25000,
                   'A reliable sedan'
               )
              ).toThrow('Validation error:'); 
    });

    it('should throw an error if mileage is negative', () => {
        expect(() => 
               new Vehicle(
                   undefined,
                   'ALC743',
                   'Toyota',
                   'Corolla',
                   'Red',
                   -1,
                   25000,
                   'A reliable sedan'
               )
              ).toThrow('Validation error:'); 
    });

    it('should throw an error if base price is zero', () => {
        expect(() => 
               new Vehicle(
                   undefined,
                   'ALC743',
                   'Toyota',
                   'Corolla',
                   'Red',
                   25000,
                   0,
                   'A reliable sedan'
               )
              ).toThrow('Validation error:'); 
    });

    it('should throw an error if base price is negative', () => {
        expect(() => 
               new Vehicle(
                   undefined,
                   'ALC743',
                   'Toyota',
                   'Corolla',
                   'Red',
                   25000,
                   -1,
                   'A reliable sedan'
               )
              ).toThrow('Validation error:'); 
    });
});
