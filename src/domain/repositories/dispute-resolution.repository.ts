import { DisputeResolution } from '../entities/dispute-resolution.entity';

export interface DisputeResolutionRepository {
  save(dispute: DisputeResolution): Promise<DisputeResolution>;
  findByTicketId(ticketId: string): Promise<DisputeResolution | null>;
  findById(id: string): Promise<DisputeResolution | null>;
}

export const DISPUTE_RESOLUTION_REPOSITORY = Symbol('DisputeResolutionRepository');
