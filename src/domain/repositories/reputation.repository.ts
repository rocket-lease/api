import { Penalty, PenaltyRole } from '../entities/penalty.entity';

export interface ReputationData {
  id: string;
  userId: string;
  scoreAsDriver: number;
  scoreAsRenter: number;
  reviewCountAsDriver: number;
  reviewCountAsRenter: number;
  penaltyCountAsDriver: number;
  penaltyCountAsRenter: number;
  suspendedAsDriver: boolean;
  suspendedAsRenter: boolean;
}

export interface ReputationRepository {
  getReputationData(userId: string): Promise<ReputationData>;
  savePenalty(penalty: Penalty): Promise<Penalty>;
  findPenaltyByTicketId(ticketId: string): Promise<Penalty | null>;
  updateScoreAndCounts(
    userId: string,
    role: PenaltyRole,
    score: number,
    reviewCount: number,
  ): Promise<void>;
  updatePenaltyCountAndSuspension(
    userId: string,
    role: PenaltyRole,
    penaltyCount: number,
    suspended: boolean,
  ): Promise<void>;
  updateVehicleOwnerReputationScore(ownerId: string, score: number): Promise<void>;
  getAverageRatingAsTarget(
    userId: string,
    targetType: PenaltyRole,
  ): Promise<{ avg: number; count: number }>;
}

export const REPUTATION_REPOSITORY = Symbol('ReputationRepository');
