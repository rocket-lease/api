import { VehicleRepository, VehicleSearchParams } from '@/domain/repositories/vehicle.repository';
import { PrismaService } from '../database/prisma.service';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PostgresVehicleRepository implements VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(vehicle: Vehicle): Promise<Vehicle> {
    await this.prisma.vehicle.upsert({
      where: { id: vehicle.getId() },
      update: {
        mileage: vehicle.getMileage(),
        color: vehicle.getColor(),
        basePrice: vehicle.getBasePrice(),
        description: vehicle.getDescription(),
        isAccessible: vehicle.getIsAccessible(),
        enabled: vehicle.isEnabled(),
        photos: {
          deleteMany: {},
          create: vehicle.getPhotos().map((url) => ({ url })),
        },
      },
      create: {
        id: vehicle.getId(),
        ownerId: vehicle.getOwnerId(),
        plate: vehicle.getPlate(),
        brand: vehicle.getBrand(),
        model: vehicle.getModel(),
        year: vehicle.getYear(),
        passengers: vehicle.getPassengers(),
        trunkLiters: vehicle.getTrunkLiters(),
        transmission: vehicle.getTransmission() as any,
        isAccessible: vehicle.getIsAccessible(),
        mileage: vehicle.getMileage(),
        color: vehicle.getColor(),
        basePrice: vehicle.getBasePrice(),
        description: vehicle.getDescription(),
        photos: {
          create: vehicle.getPhotos().map((url) => ({ url })),
        },
      },
    });
    return vehicle;
  }

  async findById(id: string): Promise<Vehicle | null> {
    const raw = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { photos: true },
    });

    if (!raw) return null;

    return new Vehicle(
      raw.id,
      raw.ownerId,
      raw.plate,
      raw.brand,
      raw.model,
      raw.year,
      raw.passengers,
      raw.trunkLiters,
      raw.transmission as any,
      raw.isAccessible,
      raw.enabled,
      raw.photos.map((p) => p.url),
      raw.color,
      raw.mileage,
      raw.basePrice,
      raw.description,
    );
  }

  async findByPlate(plate: string): Promise<Vehicle | null> {
    const raw = await this.prisma.vehicle.findUnique({
      where: { plate },
      include: { photos: true },
    });

    if (!raw) return null;
    return this.mapToDomain(raw);
  }

  async findByOwnerId(ownerId: string): Promise<Vehicle[]> {
    const raws = await this.prisma.vehicle.findMany({
      where: { ownerId },
      include: { photos: true },
    });
    return raws.map((raw) => this.mapToDomain(raw));
  }

  async fetchAll(): Promise<Vehicle[]> {
    const raws = await this.prisma.vehicle.findMany({
      where: { enabled: true },
      include: { photos: true },
    });
    return raws.map((raw) => this.mapToDomain(raw));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.vehicle.delete({ where: { id } });
  }

  async search(params: VehicleSearchParams): Promise<Vehicle[]> {
    const raws = await this.prisma.vehicle.findMany({
      where: {
        enabled: true,
        ...(params.transmission   && { transmission: params.transmission as any }),
        ...(params.minPrice       !== undefined && { basePrice: { gte: params.minPrice } }),
        ...(params.maxPrice       !== undefined && { basePrice: { lte: params.maxPrice } }),
        ...(params.minSeats       !== undefined && { passengers: { gte: params.minSeats } }),
        ...(params.minTrunkLiters !== undefined && { trunkLiters: { gte: params.minTrunkLiters } }),
        ...(params.minYear        !== undefined && { year: { gte: params.minYear } }),
        ...(params.maxYear        !== undefined && { year: { lte: params.maxYear } }),
        ...(params.model          && { model: { contains: params.model, mode: 'insensitive' as const } }),
        ...(params.isAccessible   !== undefined && { isAccessible: params.isAccessible }),
      },
      include: { photos: true },
    });
    return raws.map((raw) => this.mapToDomain(raw));
  }

  private mapToDomain(raw: any): Vehicle {
    return new Vehicle(
      raw.id,
      raw.ownerId,
      raw.plate,
      raw.brand,
      raw.model,
      raw.year,
      raw.passengers,
      raw.trunkLiters,
      raw.transmission,
      raw.isAccessible,
      raw.enabled,
      raw.photos.map((p: any) => p.url),
      raw.color,
      raw.mileage,
      raw.basePrice,
      raw.description,
    );
  }
}
