import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const vehicleSchema = z.object({
    id: z.string().uuid("Invalid ID format"),
    plate: z.string().trim().min(1, "Plate cannot be empty"),
    brand: z.string().min(1, "Brand is required"),
    model: z.string().min(1, "Model is required"),
    color: z.string().min(1, "Color is required"),
    mileage: z.number().min(0, "Mileage cannot be negative"),
    basePrice: z.number().gt(0, "Base price must be greater than zero"),
    description: z.string().nullable()
});

export class Vehicle {
    constructor(
        public readonly id: string = randomUUID(),
        public readonly plate: string,
        public readonly brand: string,
        public readonly model: string,
        public readonly color: string,
        public readonly mileage: number,
        public readonly basePrice: number,
        public readonly description: string | null,
    ) {
        this.validate();
    }

    private validate(): void {
        const result = vehicleSchema.safeParse({
            id: this.id, 
            plate: this.plate,
            brand: this.brand,
            model: this.model,
            color: this.color,
            mileage: this.mileage,
            basePrice: this.basePrice,
            description: this.description,
        });

        if (!result.success) {
            throw new InvalidEntityDataException(result.error.issues[0].message);
        }
    }

    public getPlate(): string {
        return this.plate;
    }
}
