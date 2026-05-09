import { Vehicle } from '@/domain/vehicle.entity';

describe('Vehicle Entity', () => {
  it('should throw an error if plate is empty', () => {
    expect(() => new Vehicle('')).toThrow('Cannot create a vehicle with an empty plate');
  });
});
