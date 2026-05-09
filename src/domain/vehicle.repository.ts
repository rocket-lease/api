import { Vehicle } from './vehicle.entity';

export interface VehicleRepository {
  save(vehicle: Vehicle): Promise<void>;
  findByPlate(plate: string): Promise<boolean>;
}

export const VEHICLE_REPOSITORY = Symbol('VehicleRepository');
