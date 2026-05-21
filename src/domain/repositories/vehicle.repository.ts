import { Vehicle } from '../entities/vehicle.entity';
import { BulkPriceOperation, BulkPriceUpdateResponse, Characteristic } from '@rocket-lease/contracts';

export interface VehicleFilter {
  city?: string;
  from?: string;
  to?: string;
}

export interface VehicleRepository {
  save(vehicle: Vehicle): Promise<Vehicle>;
  fetchAll(filter?: VehicleFilter): Promise<Vehicle[]>;
  findById(id: string): Promise<Vehicle | null>;
  findByIds(ids: string[]): Promise<Vehicle[]>;
  findByPlate(plate: string): Promise<Vehicle | null>;
  findByOwnerId(ownerId: string): Promise<Vehicle[]>;
  findByCharacteristics(characteristics: Characteristic[], filter?: VehicleFilter): Promise<Vehicle[]>;
  delete(id: string): Promise<void>;
  bulkUpdatePrices(vehicleIds: string[], operation: BulkPriceOperation, ownerId: string): Promise<BulkPriceUpdateResponse>;
  countActiveReservationsByVehicleIds(vehicleIds: string[], ownerId: string): Promise<Record<string, number>>;
}

export const VEHICLE_REPOSITORY = Symbol('VehicleRepository');
