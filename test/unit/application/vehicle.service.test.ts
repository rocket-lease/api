import { Vehicle } from "@/domain/entities/vehicle.entity";
import { VehicleRepository } from "@/domain/repositories/vehicle.repository";
import { VehicleService } from "@/application/vehicle.service";
import { CreateVehicleResponseSchema } from "@rocket-lease/contracts";
import { randomUUID } from "crypto";

describe('VehicleService', () => {
    let service: VehicleService;
    let repositoryMock: jest.Mocked<VehicleRepository>;

    beforeEach(() => {
        repositoryMock = {
            save: jest.fn(),
            fetchAll: jest.fn(),
            findById: jest.fn(),
            findByPlate: jest.fn(),
            findByOwnerId: jest.fn(),
            findByCharacteristics: jest.fn(),
            delete: jest.fn(),
        };

        service = new VehicleService(repositoryMock);
    });

    it('should create a vehicle with characteristics', async () => {
        const ownerId = randomUUID();
        const dto = {
            plate: 'ABC123',
            brand: 'Toyota',
            model: 'Corolla',
            year: 2022,
            passengers: 5,
            trunkLiters: 450,
            transmission: 'Manual' as const,
            isAccessible: false,
            photos: ['https://example.com/photo1.jpg'],
            color: 'Blue',
            mileage: 100,
            basePrice: 5000,
            description: null,
            availableFrom: '2026-05-13',
            province: 'BA',
            city: 'CABA',
            characteristics: ['GPS', 'BLUETOOTH'] as const,
        };

        const expectedVehicle = new Vehicle(
            undefined,
            ownerId,
            dto.plate,
            dto.brand,
            dto.model,
            dto.year,
            dto.passengers,
            dto.trunkLiters,
            dto.transmission,
            dto.isAccessible,
            true,
            dto.photos,
            [...dto.characteristics],
            dto.color,
            dto.mileage,
            dto.basePrice,
            dto.description,
            dto.province,
            dto.city,
            dto.availableFrom,
        );

        repositoryMock.findByPlate.mockResolvedValue(null);
        repositoryMock.save.mockResolvedValue(expectedVehicle);

        const response = await service.createVehicle(ownerId, dto);

        expect(repositoryMock.save).toHaveBeenCalledWith(expect.any(Vehicle));
        expect(response).toEqual({ id: expectedVehicle.getId() });
        expect(() => CreateVehicleResponseSchema.parse(response)).not.toThrow();
    });

    it('should filter vehicles by characteristics', async () => {
        repositoryMock.findByCharacteristics.mockResolvedValue([]);
        await service.getByCharacteristics(['GPS']);
        expect(repositoryMock.findByCharacteristics).toHaveBeenCalledWith(['GPS']);
    });

    it('should reject delete by non-owner', async () => {
        const vehicleId = randomUUID();
        const ownerId = randomUUID();
        const intruderId = randomUUID();
        const vehicle = new Vehicle(
            vehicleId,
            ownerId,
            'ABC123',
            'Toyota',
            'Corolla',
            2022,
            5,
            450,
            'Manual',
            false,
            true,
            ['https://example.com/photo.jpg'],
            [],
            'Blue',
            100,
            5000,
            null,
            'BA',
            'CABA',
            '2026-05-13',
        );
        repositoryMock.findById.mockResolvedValue(vehicle);

        await expect(service.deleteVehicle(vehicleId, intruderId)).rejects.toThrow();
        expect(repositoryMock.delete).not.toHaveBeenCalled();
    });
});
