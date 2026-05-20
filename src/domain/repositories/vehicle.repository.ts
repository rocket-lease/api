import { Vehicle } from '../entities/vehicle.entity';
import { Characteristic } from '@rocket-lease/contracts';

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
}

export const VEHICLE_REPOSITORY = Symbol('VehicleRepository');
