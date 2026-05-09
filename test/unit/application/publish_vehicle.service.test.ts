import { Vehicle } from "@/domain/vehicle.entity";
import { VehicleRepository } from "@/domain/vehicle.repository";
import { PublishVehicleService } from "@/application/publish_vehicle/publish_vehicle.service";

describe('PublishVehicleService', () => {
  let service: PublishVehicleService;
  let repositoryMock: jest.Mocked<VehicleRepository>;

  beforeEach(() => {
    repositoryMock = {
      save: jest.fn(),
      findByPlate: jest.fn(),
    };

    service = new PublishVehicleService(repositoryMock);
  });

  it('should create a vehicle', async () => {
    const dto = { plate: 'AE987CC' }; //TODO: Usar dto
    await service.execute(dto);
    expect(repositoryMock.save).toHaveBeenCalledWith(expect.any(Vehicle));
  })
});
