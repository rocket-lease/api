import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const vehicleSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
  ownerId: z.string().uuid('Invalid ID format'),
  plate: z.string().trim().min(1, 'Plate cannot be empty'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1, 'Invalid year'),
  passengers: z
    .number()
    .int()
    .min(1, 'Must have at least 1 passenger capacity'),
  trunkLiters: z.number().min(0, 'Trunk capacity cannot be negative'),
  transmission: z.enum(['Manual', 'Automatico', 'Semiautomatico'], {
    errorMap: () => ({ message: 'Invalid transmission type' }),
  }),
  isAccessible: z.boolean(),
  enabled: z.boolean(),
  photos: z
    .array(z.string().url('Invalid photo URL format'))
    .min(1, 'At least one photo is required'),
  color: z.string().min(1, 'Color is required'),
  mileage: z.number().min(0, 'Mileage cannot be negative'),
  basePrice: z.number().gt(0, 'Base price must be greater than zero'),
  description: z.string().nullable(),
  province: z.string().min(1, 'Province is required'),
  city: z.string().min(1, 'City is required'),
  availableFrom: z.string().date('Invalid date format'),
  characteristics: z.array(
    z.enum([
      'GPS',
      'BABY_SEAT',
      'SUNROOF',
      'PET_FRIENDLY',
      'WIFI',
      'USB_CHARGER',
      'AUX_CABLE',
      'BLUETOOTH',
    ]),
  ),
});

export class Vehicle {
  constructor(
    private readonly id: string = randomUUID(),
    private readonly ownerId: string,
    private readonly plate: string,
    private readonly brand: string,
    private readonly model: string,
    private readonly year: number,
    private readonly passengers: number,
    private readonly trunkLiters: number,
    private readonly transmission: 'Manual' | 'Automatico' | 'Semiautomatico',
    private isAccessible: boolean,
    private enabled: boolean,
    private photos: string[],
    private characteristics: Array<
      | 'GPS'
      | 'BABY_SEAT'
      | 'SUNROOF'
      | 'PET_FRIENDLY'
      | 'WIFI'
      | 'USB_CHARGER'
      | 'AUX_CABLE'
      | 'BLUETOOTH'
    >,
    private color: string,
    private mileage: number,
    private basePrice: number,
    private description: string | null,
    private province: string,
    private city: string,
    private availableFrom: string,
  ) {
    this.validate();
  }

  public getId(): string {
    return this.id;
  }
  public getOwnerId(): string {
    return this.ownerId;
  }
  public getPlate(): string {
    return this.plate;
  }
  public getBrand(): string {
    return this.brand;
  }
  public getModel(): string {
    return this.model;
  }
  public getYear(): number {
    return this.year;
  }
  public getPassengers(): number {
    return this.passengers;
  }
  public getTrunkLiters(): number {
    return this.trunkLiters;
  }
  public getTransmission(): string {
    return this.transmission;
  }
  public getIsAccessible(): boolean {
    return this.isAccessible;
  }
  public getPhotos(): string[] {
    return [...this.photos];
  }
  public getCharacteristics(): Array<
    | 'GPS'
    | 'BABY_SEAT'
    | 'SUNROOF'
    | 'PET_FRIENDLY'
    | 'WIFI'
    | 'USB_CHARGER'
    | 'AUX_CABLE'
    | 'BLUETOOTH'
  > {
    return [...this.characteristics];
  }
  public getColor(): string {
    return this.color;
  }
  public getMileage(): number {
    return this.mileage;
  }
  public getBasePrice(): number {
    return this.basePrice;
  }
  public getDescription(): string | null {
    return this.description;
  }
  public getProvince(): string {
    return this.province;
  }
  public getCity(): string {
    return this.city;
  }
  public getAvailableFrom(): string {
    return this.availableFrom;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public updateMileage(newMileage: number): void {
    if (newMileage < this.mileage) {
      throw new InvalidEntityDataException(
        `El kilometraje no puede ser inferior al actual (${this.mileage})`,
      );
    }
    this.validateField('mileage', newMileage);
    this.mileage = newMileage;
  }

  public isOwnedBy(userId: string): boolean {
    return this.ownerId === userId;
  }

  public update(data: any): void {
    if (data.mileage !== undefined) this.updateMileage(data.mileage);
    if (data.photos) this.photos = data.photos;
    if (data.characteristics) {
      this.characteristics = Array.from(new Set(data.characteristics));
    }
    if (data.color) this.color = data.color;
    if (data.basePrice) this.basePrice = data.basePrice;
    if (data.description !== undefined) this.description = data.description;
    if (data.isAccessible !== undefined) this.isAccessible = data.isAccessible;
    if (data.enabled !== undefined) this.enabled = data.enabled;
    if (data.province !== undefined) this.province = data.province;
    if (data.city !== undefined) this.city = data.city;
    if (data.availableFrom !== undefined)
      this.availableFrom = data.availableFrom;
    this.validate();
  }

  private validate(): void {
    const result = vehicleSchema.safeParse({
      id: this.id,
      ownerId: this.ownerId,
      plate: this.plate,
      brand: this.brand,
      model: this.model,
      year: this.year,
      passengers: this.passengers,
      trunkLiters: this.trunkLiters,
      transmission: this.transmission,
      isAccessible: this.isAccessible,
      enabled: this.enabled,
      photos: this.photos,
      color: this.color,
      mileage: this.mileage,
      basePrice: this.basePrice,
      description: this.description,
      province: this.province,
      city: this.city,
      availableFrom: this.availableFrom,
      characteristics: this.characteristics,
    });

    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }

  private validateField(field: string, value: any): void {
    const fieldSchema =
      vehicleSchema.shape[field as keyof typeof vehicleSchema.shape];
    if (fieldSchema) {
      const result = fieldSchema.safeParse(value);
      if (!result.success) {
        throw new InvalidEntityDataException(result.error.issues[0].message);
      }
    }
  }
}
