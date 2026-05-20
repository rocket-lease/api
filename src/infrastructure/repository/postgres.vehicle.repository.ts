import { VehicleRepository, type VehicleFilter } from '@/domain/repositories/vehicle.repository';
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
        province: vehicle.getProvince(),
        city: vehicle.getCity(),
        availableFrom: vehicle.getAvailableFrom(),
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
        province: vehicle.getProvince(),
        city: vehicle.getCity(),
        availableFrom: vehicle.getAvailableFrom(),
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

    return this.mapToDomain(raw);
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

  async fetchAll(filter?: VehicleFilter): Promise<Vehicle[]> {
    const and: object[] = [{ enabled: true }];

    if (filter?.city) {
      and.push({ city: { equals: filter.city, mode: 'insensitive' } });
    }

    if (filter?.from && filter.to) {
      and.push({
        NOT: {
          reservations: {
            some: {
              status: { in: ['confirmed', 'in_progress'] },
              startAt: { lt: new Date(filter.to) },
              endAt:   { gt: new Date(filter.from) },
            },
          },
        },
      });
    }

    const raws = await this.prisma.vehicle.findMany({
      where: { AND: and },
      include: { photos: true },
      orderBy: { basePrice: 'asc' },
    });
    return raws.map((raw) => this.mapToDomain(raw));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.vehicle.delete({ where: { id } });
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
      raw.province,
      raw.city,
      raw.availableFrom,
    );
  }
}
