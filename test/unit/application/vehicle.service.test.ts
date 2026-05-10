// TODO: deberia chequear que sea un response DTO
import { Vehicle } from "@/domain/entities/vehicle.entity";
import { VehicleRepository } from "@/domain/repositories/vehicle.repository";
import { VehicleService } from "@/application/vehicle.service";

describe('VehicleService', () => {
  let service: VehicleService;
  let repositoryMock: jest.Mocked<VehicleRepository>;

  beforeEach(() => {
    repositoryMock = {
      save: jest.fn(),
      fetchAll: jest.fn(),
      findByPlate: jest.fn(),
    };

    service = new VehicleService(repositoryMock);
  });

  it('should create a vehicle', async () => {
    const dto = {
        id: 'id',
        plate: 'plate',
        brand: 'brand',
        model: 'model',
        color: 'color',
        mileage: 10,
        basePrice: 10,
        description: null,
    }
    repositoryMock.save.mockReturnValue(dto);
    const createVehicleResponse = await service.createVehicle(dto);
    expect(repositoryMock.save).toHaveBeenCalledWith(expect.any(Vehicle));
  })
});
