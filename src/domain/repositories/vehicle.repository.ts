import { Vehicle } from '../entities/vehicle.entity';

export interface VehicleRepository {
  save(vehicle: Vehicle): Promise<Vehicle>;
  fetchAll(): Promise<Array<Vehicle>>;
  findByPlate(plate: string): Promise<Vehicle | null>;
}

export const VEHICLE_REPOSITORY = Symbol('VehicleRepository');
