import { Vehicle } from '@/domain/entities/vehicle.entity';
import { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import { VehicleService } from '@/application/vehicle.service';
import { CreateVehicleResponseSchema } from '@rocket-lease/contracts';
import { randomUUID } from 'crypto';

const OWNER_ID = randomUUID();

const validDto = {
    plate: 'ABC-123',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2020,
    passengers: 5,
    trunkLiters: 400,
    transmission: 'Manual' as const,
    isAccessible: false,
    photos: ['https://example.com/photo.jpg'],
    color: 'Blue',
    mileage: 100,
    basePrice: 5000,
    description: null,
    province: 'Buenos Aires',
    city: 'La Plata',
    availableFrom: '2025-01-01',
};

describe('VehicleService', () => {
    let service: VehicleService;
    let repositoryMock: jest.Mocked<VehicleRepository>;

    beforeEach(() => {
        repositoryMock = {
            save: jest.fn(),
            fetchAll: jest.fn(),
            findById: jest.fn().mockResolvedValue(null),
            findByPlate: jest.fn().mockResolvedValue(null),
            findByOwnerId: jest.fn().mockResolvedValue([]),
            delete: jest.fn().mockResolvedValue(undefined),
        };

        service = new VehicleService(repositoryMock);
    });

    it('should create a vehicle', async () => {
        const id = randomUUID();
        const expectedVehicle = new Vehicle(
            id,
            OWNER_ID,
            validDto.plate,
            validDto.brand,
            validDto.model,
            validDto.year,
            validDto.passengers,
            validDto.trunkLiters,
            validDto.transmission,
            validDto.isAccessible,
            true,
            validDto.photos,
            validDto.color,
            validDto.mileage,
            validDto.basePrice,
            validDto.description,
            validDto.province,
            validDto.city,
            validDto.availableFrom,
        );

        repositoryMock.findByPlate.mockResolvedValue(null);
        repositoryMock.save.mockResolvedValue(expectedVehicle);

        const response = await service.createVehicle(OWNER_ID, validDto);

        expect(repositoryMock.save).toHaveBeenCalledWith(expect.any(Vehicle));
        expect(response).toEqual({ id: expectedVehicle.getId() });
        expect(() => CreateVehicleResponseSchema.parse(response)).not.toThrow();
    });

    it('should throw when plate already exists', async () => {
        const existingVehicle = new Vehicle(
            randomUUID(),
            OWNER_ID,
            validDto.plate,
            validDto.brand,
            validDto.model,
            validDto.year,
            validDto.passengers,
            validDto.trunkLiters,
            validDto.transmission,
            validDto.isAccessible,
            true,
            validDto.photos,
            validDto.color,
            validDto.mileage,
            validDto.basePrice,
            validDto.description,
            validDto.province,
            validDto.city,
            validDto.availableFrom,
        );

        repositoryMock.findByPlate.mockResolvedValue(existingVehicle);

        await expect(service.createVehicle(OWNER_ID, validDto)).rejects.toThrow();
        expect(repositoryMock.save).not.toHaveBeenCalled();
    });
});
