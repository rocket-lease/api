import { Injectable } from '@nestjs/common';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { VehicleRepository } from '@/domain/repositories/vehicle.repository';

@Injectable()
export class InMemoryVehicleRepository implements VehicleRepository {
    private readonly storage: Map<string, any> = new Map();

    async save(vehicle: Vehicle): Promise<void> {
        const { ...data } = vehicle as any;

        this.storage.set(data.id, {
            id: data.id,
            plate: data.plate,
            brand: data.brand,
            model: data.model,
            color: data.color,
            mileage: data.mileage,
            basePrice: data.basePrice,
            description: data.description,
        });
    }

    async findByPlate(plate: string): Promise<Vehicle | null> {
        const data = Array.from(this.storage.values()).find(
            (v) => v.plate === plate
        );
        if (!data) return null;
        return this.reconstitute(data);
    }

    async fetchAll(): Promise<Array<Vehicle>> {
        return Array.from(this.storage.values()).map(this.reconstitute);
    }

    private reconstitute(data: any): Vehicle {
        return new Vehicle(
            data.id,
            data.plate,
            data.brand,
            data.model,
            data.color,
            data.mileage,
            data.basePrice,
            data.description
        );
    }

    public async clean(): Promise<void> {
        this.storage.clear();
    }
}
