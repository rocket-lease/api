import { Vehicle } from '../entities/vehicle.entity';

export interface VehicleFilter {
  city?: string;
  from?: string;
  to?: string;
}

export interface VehicleRepository {
  save(vehicle: Vehicle): Promise<Vehicle>;
  fetchAll(filter?: VehicleFilter): Promise<Vehicle[]>;
  findById(id: string): Promise<Vehicle | null>;
  findByPlate(plate: string): Promise<Vehicle | null>;
  findByOwnerId(ownerId: string): Promise<Vehicle[]>;
  delete(id: string): Promise<void>;
}

export const VEHICLE_REPOSITORY = Symbol('VehicleRepository');
