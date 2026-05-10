import { z } from 'zod';

const vehicleSchema = z.object({
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
    private readonly plate: string,
    private readonly brand: string,
    private readonly model: string,
    private color: string,
    private mileage: number,
    private basePrice: number,
    private description: string,
  ) {
    this.validate();
  }

  private validate(): void {
    const result = vehicleSchema.safeParse({
      plate: this.plate,
      brand: this.brand,
      model: this.model,
      color: this.color,
      mileage: this.mileage,
      basePrice: this.basePrice,
      description: this.description,
    });

    if (!result.success) {
      throw new Error(result.error.issues[0].message);
    }
  }

  public getPlate(): string {
      return this.plate;
  }
}
