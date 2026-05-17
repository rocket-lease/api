import { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import { PrismaService } from '../database/prisma.service';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Characteristic } from '@rocket-lease/contracts';
import type { Prisma } from '@prisma/client';

const VEHICLE_INCLUDE = {
  photos: true,
  characteristics: true,
} as const satisfies Prisma.VehicleInclude;

type VehicleWithRelations = Prisma.VehicleGetPayload<{
  include: typeof VEHICLE_INCLUDE;
}>;

@Injectable()
export class PostgresVehicleRepository implements VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(vehicle: Vehicle): Promise<Vehicle> {
    const characteristics = vehicle.getCharacteristics();

    await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.upsert({
        where: { id: vehicle.getId() },
        update: {
          mileage: vehicle.getMileage(),
          color: vehicle.getColor(),
          basePriceCents: vehicle.getBasePriceCents(),
          description: vehicle.getDescription(),
          isAccessible: vehicle.getIsAccessible(),
          enabled: vehicle.isEnabled(),
          province: vehicle.getProvince(),
          city: vehicle.getCity(),
          availableFrom: vehicle.getAvailableFrom(),
          autoAccept: vehicle.getAutoAccept(),
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
          basePriceCents: vehicle.getBasePriceCents(),
          description: vehicle.getDescription(),
          province: vehicle.getProvince(),
          city: vehicle.getCity(),
          availableFrom: vehicle.getAvailableFrom(),
          autoAccept: vehicle.getAutoAccept(),
          photos: {
            create: vehicle.getPhotos().map((url) => ({ url })),
          },
        },
      });

      await tx.vehicleCharacteristic.deleteMany({
        where: { vehicleId: vehicle.getId() },
      });

      if (characteristics.length > 0) {
        await tx.vehicleCharacteristic.createMany({
          data: characteristics.map((characteristic) => ({
            id: randomUUID(),
            vehicleId: vehicle.getId(),
            characteristic,
          })),
        });
      }
    });
    return vehicle;
  }

  async findById(id: string): Promise<Vehicle | null> {
    const raw = await this.prisma.vehicle.findUnique({
      where: { id },
      include: VEHICLE_INCLUDE,
    });

    if (!raw) return null;

    return this.mapToDomain(raw);
  }

  async findByIds(ids: string[]): Promise<Vehicle[]> {
    if (ids.length === 0) return [];
    const raws = await this.prisma.vehicle.findMany({
      where: { id: { in: ids } },
      include: VEHICLE_INCLUDE,
    });
    return raws.map((r) => this.mapToDomain(r));
  }

  async findByPlate(plate: string): Promise<Vehicle | null> {
    const raw = await this.prisma.vehicle.findUnique({
      where: { plate },
      include: VEHICLE_INCLUDE,
    });

    if (!raw) return null;
    return this.mapToDomain(raw);
  }

  async findByOwnerId(ownerId: string): Promise<Vehicle[]> {
    const raws = await this.prisma.vehicle.findMany({
      where: { ownerId },
      include: VEHICLE_INCLUDE,
    });
    return raws.map((raw) => this.mapToDomain(raw));
  }

  async fetchAll(): Promise<Vehicle[]> {
    const raws = await this.prisma.vehicle.findMany({
      where: { enabled: true },
      include: VEHICLE_INCLUDE,
    });
    return raws.map((raw) => this.mapToDomain(raw));
  }

  async findByCharacteristics(
    characteristics: Characteristic[],
  ): Promise<Vehicle[]> {
    if (characteristics.length === 0) {
      return this.fetchAll();
    }

    const filters = characteristics.map((item) => ({
      characteristics: { some: { characteristic: item } },
    }));

    const raws = await this.prisma.vehicle.findMany({
      where: {
        enabled: true,
        AND: filters,
      },
      include: VEHICLE_INCLUDE,
    });
    return raws.map((raw) => this.mapToDomain(raw));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.vehicle.delete({ where: { id } });
  }

  private mapToDomain(raw: VehicleWithRelations): Vehicle {
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
      raw.photos.map((p) => p.url),
      raw.characteristics.map((c) => c.characteristic),
      raw.color,
      raw.mileage,
      raw.basePriceCents,
      raw.description,
      raw.province,
      raw.city,
      raw.availableFrom,
      raw.autoAccept,
    );
  }
}
