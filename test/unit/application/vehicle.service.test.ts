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
    characteristics: ['GPS', 'BLUETOOTH'] as Array<'GPS' | 'BLUETOOTH'>,
};

const buildVehicle = (overrides: Partial<{ id: string; ownerId: string }> = {}) =>
    new Vehicle(
        overrides.id ?? randomUUID(),
        overrides.ownerId ?? OWNER_ID,
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
        [...validDto.characteristics],
        validDto.color,
        validDto.mileage,
        validDto.basePrice,
        validDto.description,
        validDto.province,
        validDto.city,
        validDto.availableFrom,
    );

describe('VehicleService', () => {
    let service: VehicleService;
    let repositoryMock: jest.Mocked<VehicleRepository>;

    beforeEach(() => {
        repositoryMock = {
            save: jest.fn(),
            fetchAll: jest.fn().mockResolvedValue([]),
            findById: jest.fn().mockResolvedValue(null),
            findByPlate: jest.fn().mockResolvedValue(null),
            findByOwnerId: jest.fn().mockResolvedValue([]),
            findByCharacteristics: jest.fn().mockResolvedValue([]),
            delete: jest.fn().mockResolvedValue(undefined),
        };

        service = new VehicleService(repositoryMock);
    });

    it('should create a vehicle with characteristics', async () => {
        const expectedVehicle = buildVehicle();
        repositoryMock.save.mockResolvedValue(expectedVehicle);

        const response = await service.createVehicle(OWNER_ID, validDto);

        expect(repositoryMock.save).toHaveBeenCalledWith(expect.any(Vehicle));
        expect(response).toEqual({ id: expectedVehicle.getId() });
        expect(() => CreateVehicleResponseSchema.parse(response)).not.toThrow();
    });

    it('should throw when plate already exists', async () => {
        repositoryMock.findByPlate.mockResolvedValue(buildVehicle());

        await expect(service.createVehicle(OWNER_ID, validDto)).rejects.toThrow();
        expect(repositoryMock.save).not.toHaveBeenCalled();
    });

    it('should filter vehicles by characteristics', async () => {
        await service.getByCharacteristics(['GPS']);
        expect(repositoryMock.findByCharacteristics).toHaveBeenCalledWith(['GPS']);
    });

    it('should reject delete by non-owner', async () => {
        const vehicleId = randomUUID();
        const intruderId = randomUUID();
        repositoryMock.findById.mockResolvedValue(buildVehicle({ id: vehicleId }));

        await expect(service.deleteVehicle(vehicleId, intruderId)).rejects.toThrow();
        expect(repositoryMock.delete).not.toHaveBeenCalled();
    });
});
