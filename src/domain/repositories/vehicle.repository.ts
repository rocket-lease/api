import { Vehicle } from '../entities/vehicle.entity';

export interface SearchParams {
  city: string;
  startDate?: Date;
  endDate?: Date;
}

export interface VehicleRepository {
  save(vehicle: Vehicle): Promise<Vehicle>;
  fetchAll(): Promise<Vehicle[]>;
  findById(id: string): Promise<Vehicle | null>;
  findByPlate(plate: string): Promise<Vehicle | null>;
  findByOwnerId(ownerId: string): Promise<Vehicle[]>;
  delete(id: string): Promise<void>;
  search(params: SearchParams): Promise<Vehicle[]>;
}

export const VEHICLE_REPOSITORY = Symbol('VehicleRepository');
