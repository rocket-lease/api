import { Vehicle } from "@/domain/entities/vehicle.entity";
import { VehicleRepository } from "@/domain/repositories/vehicle.repository";
import { VehicleService } from "@/application/vehicle.service";
import { CreateVehicleRequestSchema, CreateVehicleResponseSchema } from "@rocket-lease/contracts";
import { randomUUID } from "crypto";

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
            plate: 'ABC-123',
            brand: 'Toyota',
            model: 'Corolla',
            color: 'Blue',
            mileage: 100,
            basePrice: 5000,
            description: null,
        };

        const id = randomUUID();
        const expectedVehicle = new Vehicle(
            id,
            dto.plate,
            dto.brand,
            dto.model,
            dto.color,
            dto.mileage,
            dto.basePrice,
            dto.description,
        );

        repositoryMock.findByPlate.mockResolvedValue(null);
        repositoryMock.save.mockResolvedValue(expectedVehicle);

        const response = await service.createVehicle(dto);

        expect(repositoryMock.save).toHaveBeenCalledWith(expect.any(Vehicle));
        expect(response).toEqual({id: expectedVehicle.id});
        expect(() => CreateVehicleResponseSchema.parse(response)).not.toThrow();
    });
});
