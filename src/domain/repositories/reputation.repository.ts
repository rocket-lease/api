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
  getReputationData(userId: string, tx?: unknown): Promise<ReputationData>;
  savePenalty(penalty: Penalty, tx?: unknown): Promise<Penalty>;
  findPenaltyByTicketAndUser(
    ticketId: string,
    userId: string,
    tx?: unknown,
  ): Promise<Penalty | null>;
  updateScoreAndCounts(
    userId: string,
    role: PenaltyRole,
    score: number,
    reviewCount: number,
    tx?: unknown,
  ): Promise<void>;
  updatePenaltyCountAndSuspension(
    userId: string,
    role: PenaltyRole,
    penaltyCount: number,
    suspended: boolean,
    tx?: unknown,
  ): Promise<void>;
  updateVehicleOwnerReputationScore(
    ownerId: string,
    score: number,
    tx?: unknown,
  ): Promise<void>;
  getAverageRatingAsTarget(
    userId: string,
    targetType: PenaltyRole,
  ): Promise<{ avg: number; count: number }>;
}

export const REPUTATION_REPOSITORY = Symbol('ReputationRepository');
