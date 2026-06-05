import { VehicleRepository, type VehicleFilter } from '@/domain/repositories/vehicle.repository';
import { PrismaService } from '../database/prisma.service';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BulkPriceOperation, BulkPriceUpdateResponse, Characteristic } from '@rocket-lease/contracts';
import {
  BulkPriceVehicleNotOwnedException,
  BulkPriceResultInvalidException,
} from '@/domain/exceptions/bulk-price.exception';
import type { Prisma } from '@prisma/client';

const VEHICLE_INCLUDE = {
  // Photos no tienen columna de orden; ordenamos por URL para que las que
  // siguen la convención `<modelo>-1.jpg`, `<modelo>-2.jpg`, ... salgan
  // siempre estables. Para fotos sin sufijo numérico el orden es lex de URL.
  photos: { orderBy: { url: 'asc' } },
  characteristics: true,
  discountTiers: { orderBy: { minimumDays: 'asc' } },
} as const satisfies Prisma.VehicleInclude;

type VehicleWithRelations = Prisma.VehicleGetPayload<{
  include: typeof VEHICLE_INCLUDE;
}>;

@Injectable()
export class PostgresVehicleRepository implements VehicleRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async save(vehicle: Vehicle): Promise<Vehicle> {
    const characteristics = vehicle.getCharacteristics();
    const discountTiers = vehicle.getDiscountTiers();

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
          reservationRuleSetId: vehicle.getReservationRuleSetId(),
          province: vehicle.getProvince(),
          city: vehicle.getCity(),
          address: vehicle.getAddress(),
          latitude: vehicle.getLatitude(),
          longitude: vehicle.getLongitude(),
          locationApproximate: vehicle.isLocationApproximate(),
          availableFrom: vehicle.getAvailableFrom(),
          autoAccept: vehicle.getAutoAccept(),
          homeDeliveryEnabled: vehicle.getHomeDeliveryEnabled(),
          homeDeliveryFeeCents: vehicle.getHomeDeliveryFeeCents(),
          homeReturnEnabled: vehicle.getHomeReturnEnabled(),
          homeReturnFeeCents: vehicle.getHomeReturnFeeCents(),
          dynamicPricingEnabled: vehicle.getDynamicPricingEnabled(),
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
          enabled: vehicle.isEnabled(),
          mileage: vehicle.getMileage(),
          color: vehicle.getColor(),
          basePriceCents: vehicle.getBasePriceCents(),
          description: vehicle.getDescription(),
          reservationRuleSetId: vehicle.getReservationRuleSetId(),
          province: vehicle.getProvince(),
          city: vehicle.getCity(),
          address: vehicle.getAddress(),
          latitude: vehicle.getLatitude(),
          longitude: vehicle.getLongitude(),
          locationApproximate: vehicle.isLocationApproximate(),
          availableFrom: vehicle.getAvailableFrom(),
          autoAccept: vehicle.getAutoAccept(),
          homeDeliveryEnabled: vehicle.getHomeDeliveryEnabled(),
          homeDeliveryFeeCents: vehicle.getHomeDeliveryFeeCents(),
          homeReturnEnabled: vehicle.getHomeReturnEnabled(),
          homeReturnFeeCents: vehicle.getHomeReturnFeeCents(),
          dynamicPricingEnabled: vehicle.getDynamicPricingEnabled(),
          photos: {
            create: vehicle.getPhotos().map((url) => ({ url })),
          },
        },
      });

      await tx.vehicleDiscountTier.deleteMany({
        where: { vehicleId: vehicle.getId() },
      });

      if (discountTiers.length > 0) {
        await tx.vehicleDiscountTier.createMany({
          data: discountTiers.map((tier) => ({
            id: randomUUID(),
            vehicleId: vehicle.getId(),
            minimumDays: tier.minimumDays,
            discountPercentage: tier.discountPercentage,
          })),
        });
      }

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

  async fetchAll(filter?: VehicleFilter): Promise<Vehicle[]> {
    const raws = await this.prisma.vehicle.findMany({
      where: { AND: this.buildBaseWhere(filter) },
      include: VEHICLE_INCLUDE,
      orderBy: { basePriceCents: 'asc' },
    });
    return raws.map((raw) => this.mapToDomain(raw));
  }

  async findByCharacteristics(
    characteristics: Characteristic[],
    filter?: VehicleFilter,
  ): Promise<Vehicle[]> {
    if (characteristics.length === 0) return this.fetchAll(filter);

    const and: Prisma.VehicleWhereInput[] = [
      ...this.buildBaseWhere(filter),
      ...characteristics.map((item) => ({
        characteristics: { some: { characteristic: item } },
      })),
    ];

    const raws = await this.prisma.vehicle.findMany({
      where: { AND: and },
      include: VEHICLE_INCLUDE,
      orderBy: { basePriceCents: 'asc' },
    });
    return raws.map((raw) => this.mapToDomain(raw));
  }

  private buildBaseWhere(filter?: VehicleFilter): Prisma.VehicleWhereInput[] {
    const and: Prisma.VehicleWhereInput[] = [{ enabled: true }];

    if (filter?.city) {
      and.push({ city: { equals: filter.city, mode: 'insensitive' } });
    }

    if (filter?.from && filter?.to) {
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

    return and;
  }

  async bulkUpdatePrices(vehicleIds: string[], operation: BulkPriceOperation, ownerId: string): Promise<BulkPriceUpdateResponse> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { id: { in: vehicleIds }, ownerId },
      select: { id: true, basePriceCents: true },
    });

    if (vehicles.length !== vehicleIds.length) {
      throw new BulkPriceVehicleNotOwnedException();
    }

    const updates = vehicles.map((v) => {
      const newPriceCents =
        operation.type === 'SET'
          ? operation.valueCents
          : Math.round(v.basePriceCents * (1 + operation.delta / 100));

      if (newPriceCents <= 0) {
        throw new BulkPriceResultInvalidException(v.id);
      }

      return { id: v.id, previousPriceCents: v.basePriceCents, newPriceCents };
    });

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.vehicle.update({
          where: { id: u.id },
          data: { basePriceCents: u.newPriceCents },
        }),
      ),
    );

    return { updated: updates };
  }

  async countActiveReservationsByVehicleIds(vehicleIds: string[], ownerId: string): Promise<Record<string, number>> {
    const ownedCount = await this.prisma.vehicle.count({
      where: { id: { in: vehicleIds }, ownerId },
    });

    if (ownedCount !== vehicleIds.length) {
      throw new BulkPriceVehicleNotOwnedException();
    }

    const rows = await this.prisma.reservation.groupBy({
      by: ['vehicleId'],
      where: {
        vehicleId: { in: vehicleIds },
        status: { in: ['confirmed', 'in_progress'] },
      },
      _count: { _all: true },
    });

    const counts: Record<string, number> = Object.fromEntries(
      vehicleIds.map((id) => [id, 0]),
    );

    for (const r of rows) {
      counts[r.vehicleId] = r._count._all;
    }

    return counts;
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
      raw.discountTiers.map((tier) => ({
        minimumDays: tier.minimumDays,
        discountPercentage: tier.discountPercentage,
      })),
      raw.description,
      raw.province,
      raw.city,
      raw.availableFrom,
      raw.reservationRuleSetId,
      raw.autoAccept,
      raw.address,
      raw.latitude,
      raw.longitude,
      raw.locationApproximate,
      raw.homeDeliveryEnabled,
      raw.homeDeliveryFeeCents,
      raw.homeReturnEnabled,
      raw.homeReturnFeeCents,
      raw.dynamicPricingEnabled,
    );
  }
}
