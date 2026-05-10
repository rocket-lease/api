// TODO: deberia chequear que sea un response DTO
import { Vehicle } from "@/domain/vehicle.entity";
import { VehicleRepository } from "@/domain/vehicle.repository";
import { VehicleService } from "@/application/vehicle.service";

describe('VehicleService', () => {
  let service: VehicleService;
  let repositoryMock: jest.Mocked<VehicleRepository>;

  beforeEach(() => {
    repositoryMock = {
      save: jest.fn(),
      findByPlate: jest.fn(),
    };

    service = new VehicleService(repositoryMock);
  });

  it('should create a vehicle', async () => {
    //TODO: Usar dto
    const dto = {
        plate: 'plate',
        brand: 'brand',
        model: 'model',
        color: 'color',
        mileage: 10,
        basePrice: 10,
        description: null,
    }
    await service.publish_vehicle(dto);
    expect(repositoryMock.save).toHaveBeenCalledWith(expect.any(Vehicle));
  })
});
