import { Vehicle } from '../entities/vehicle.entity';

export interface VehicleSearchParams {
  transmission?:  string;
  minPrice?:      number;
  maxPrice?:      number;
  minSeats?:      number;
  minTrunkLiters?: number;
  minYear?:       number;
  maxYear?:       number;
  model?:         string;
  isAccessible?:  boolean;
}

export interface VehicleRepository {
  save(vehicle: Vehicle): Promise<Vehicle>;
  fetchAll(): Promise<Vehicle[]>;
  findById(id: string): Promise<Vehicle | null>;
  findByPlate(plate: string): Promise<Vehicle | null>;
  findByOwnerId(ownerId: string): Promise<Vehicle[]>;
  delete(id: string): Promise<void>;
  search(params: VehicleSearchParams): Promise<Vehicle[]>;
}

export const VEHICLE_REPOSITORY = Symbol('VehicleRepository');
