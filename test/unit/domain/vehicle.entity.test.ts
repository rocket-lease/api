import { Vehicle } from '@/domain/entities/vehicle.entity';

describe('Vehicle Entity', () => {
  it('should throw an error if plate is empty', () => {
    expect(() => new Vehicle('')).toThrow('Plate cannot be empty');
  });
});
