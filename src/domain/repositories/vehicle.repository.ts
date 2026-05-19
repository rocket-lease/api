import { Vehicle } from '../entities/vehicle.entity';
import { Characteristic } from '@rocket-lease/contracts';

export interface VehicleRepository {
  save(vehicle: Vehicle): Promise<Vehicle>;
  fetchAll(): Promise<Vehicle[]>;
  findById(id: string): Promise<Vehicle | null>;
  findByIds(ids: string[]): Promise<Vehicle[]>;
  findByPlate(plate: string): Promise<Vehicle | null>;
  findByOwnerId(ownerId: string): Promise<Vehicle[]>;
  findByCharacteristics(characteristics: Characteristic[]): Promise<Vehicle[]>;
  delete(id: string): Promise<void>;
}

export const VEHICLE_REPOSITORY = Symbol('VehicleRepository');
