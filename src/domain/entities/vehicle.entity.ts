import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { InvalidEntityDataException } from '../exceptions/domain.exception';
import { PricingDiscountTiersSchema } from '@rocket-lease/contracts';

const vehicleSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
  ownerId: z.string().uuid('Invalid ID format'),
  reservationRuleSetId: z.string().uuid('Invalid ID format').nullable().optional(),
  plate: z.string().trim().min(1, 'Plate cannot be empty'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 5, 'Invalid year'),
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
  basePriceCents: z.number().int().gt(0, 'Base price must be greater than zero'),
  discountTiers: PricingDiscountTiersSchema,
  description: z.string().nullable(),
  province: z.string().min(1, 'Province is required'),
  city: z.string().min(1, 'City is required'),
  address: z.string().min(1, 'Address is required').nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  locationApproximate: z.boolean(),
  availableFrom: z.string().date('Invalid date format'),
  autoAccept: z.boolean().nullable(),
  homeDeliveryEnabled: z.boolean(),
  homeDeliveryFeeCents: z.number().int().nonnegative().nullable(),
  homeReturnEnabled: z.boolean(),
  homeReturnFeeCents: z.number().int().nonnegative().nullable(),
  dynamicPricingEnabled: z.boolean(),
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
    private basePriceCents: number,
    private discountTiers: Array<{ minimumDays: number; discountPercentage: number }>,
    private description: string | null,
    private province: string,
    private city: string,
    private availableFrom: string,
    private reservationRuleSetId: string | null = null,
    private autoAccept: boolean | null = null,
    private address: string | null = null,
    private latitude: number | null = null,
    private longitude: number | null = null,
    private locationApproximate: boolean = false,
    private homeDeliveryEnabled: boolean = false,
    private homeDeliveryFeeCents: number | null = null,
    private homeReturnEnabled: boolean = false,
    private homeReturnFeeCents: number | null = null,
    private ownerReputationScore: number = 0,
    private dynamicPricingEnabled: boolean = false,
  ) {
    this.validate();
  }

  public getId(): string {
    return this.id;
  }
  public getOwnerId(): string {
    return this.ownerId;
  }
  public getOwnerReputationScore(): number {
    return this.ownerReputationScore;
  }
  public getReservationRuleSetId(): string | null {
    return this.reservationRuleSetId;
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
  public getBasePriceCents(): number {
    return this.basePriceCents;
  }
  public getDiscountTiers(): Array<{ minimumDays: number; discountPercentage: number }> {
    return [...this.discountTiers];
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
  public getAutoAccept(): boolean | null {
    return this.autoAccept;
  }
  public getAddress(): string | null {
    return this.address;
  }
  public getLatitude(): number | null {
    return this.latitude;
  }
  public getLongitude(): number | null {
    return this.longitude;
  }
  public isLocationApproximate(): boolean {
    return this.locationApproximate;
  }
  public getHomeDeliveryEnabled(): boolean {
    return this.homeDeliveryEnabled;
  }
  public getHomeDeliveryFeeCents(): number | null {
    return this.homeDeliveryFeeCents;
  }
  public getHomeReturnEnabled(): boolean {
    return this.homeReturnEnabled;
  }
  public getHomeReturnFeeCents(): number | null {
    return this.homeReturnFeeCents;
  }
  public getDynamicPricingEnabled(): boolean {
    return this.dynamicPricingEnabled;
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

   
  public update(data: Record<string, unknown>): void {
    if (data.mileage !== undefined) this.updateMileage(data.mileage as number);
    
    if (data.photos) this.photos = data.photos as string[];
    if (data.reservationRuleSetId !== undefined) {
      this.reservationRuleSetId = data.reservationRuleSetId as string | null;
    }
    
    if (data.characteristics) {
      this.characteristics = Array.from(
        new Set(data.characteristics as Vehicle['characteristics']),
      );
    }
    if (data.color) this.color = data.color as string;
    if (data.basePriceCents) this.basePriceCents = data.basePriceCents as number;
    if (data.discountTiers !== undefined) {
      this.discountTiers = data.discountTiers as Array<{ minimumDays: number; discountPercentage: number }>;
    }
    if (data.description !== undefined) this.description = data.description as string | null;
    if (data.isAccessible !== undefined) this.isAccessible = data.isAccessible as boolean;
    if (data.enabled !== undefined) this.enabled = data.enabled as boolean;
    if (data.province !== undefined) this.province = data.province as string;
    if (data.city !== undefined) this.city = data.city as string;
    if (data.address !== undefined) this.address = data.address as string | null;
    // Si el rentador fija coordenadas, deja de ser una ubicación aproximada.
    if (data.latitude !== undefined && data.longitude !== undefined) {
      this.latitude = data.latitude as number;
      this.longitude = data.longitude as number;
      this.locationApproximate = false;
    }
    if (data.availableFrom !== undefined)
      this.availableFrom = data.availableFrom as string;
    if (data.autoAccept !== undefined) this.autoAccept = data.autoAccept as boolean | null;
    if (data.homeDeliveryEnabled !== undefined) this.homeDeliveryEnabled = data.homeDeliveryEnabled as boolean;
    if (data.homeDeliveryFeeCents !== undefined) this.homeDeliveryFeeCents = data.homeDeliveryFeeCents as number | null;
    if (data.homeReturnEnabled !== undefined) this.homeReturnEnabled = data.homeReturnEnabled as boolean;
    if (data.homeReturnFeeCents !== undefined) this.homeReturnFeeCents = data.homeReturnFeeCents as number | null;
    if (data.dynamicPricingEnabled !== undefined) this.dynamicPricingEnabled = data.dynamicPricingEnabled as boolean;
    this.validate();
  }

  private validate(): void {
    const result = vehicleSchema.safeParse({
      id: this.id,
      ownerId: this.ownerId,
      reservationRuleSetId: this.reservationRuleSetId,
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
      basePriceCents: this.basePriceCents,
      discountTiers: this.discountTiers,
      description: this.description,
      province: this.province,
      city: this.city,
      address: this.address,
      latitude: this.latitude,
      longitude: this.longitude,
      locationApproximate: this.locationApproximate,
      availableFrom: this.availableFrom,
      autoAccept: this.autoAccept,
      homeDeliveryEnabled: this.homeDeliveryEnabled,
      homeDeliveryFeeCents: this.homeDeliveryFeeCents,
      homeReturnEnabled: this.homeReturnEnabled,
      homeReturnFeeCents: this.homeReturnFeeCents,
      dynamicPricingEnabled: this.dynamicPricingEnabled,
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
