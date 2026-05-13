import { Vehicle } from '../entities/vehicle.entity';

export interface VehicleRepository {
  save(vehicle: Vehicle): Promise<Vehicle>;
  fetchAll(): Promise<Vehicle[]>;
  findById(id: string): Promise<Vehicle | null>;
  findByPlate(plate: string): Promise<Vehicle | null>;
  findByOwnerId(ownerId: string): Promise<Vehicle[]>;
  delete(id: string): Promise<void>;
}

export const VEHICLE_REPOSITORY = Symbol('VehicleRepository');
