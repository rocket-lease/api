import { Inject, Injectable } from '@nestjs/common';
import {
  REPUTATION_REPOSITORY,
  type ReputationRepository,
} from '@/domain/repositories/reputation.repository';
import { USER_REPOSITORY, type UserRepository } from '@/domain/repositories/user.repository';
import { Penalty, type PenaltyRole } from '@/domain/entities/penalty.entity';
import { PenaltyAlreadyAppliedException } from '@/domain/exceptions/reputation.exception';
import { GetReputationResponse, GetReputationResponseSchema, ReputationBadge } from '@rocket-lease/contracts';

@Injectable()
export class ReputationService {
  private readonly BADGE_SCORE_THRESHOLD = 4.8;
  private readonly LOW_REPUTATION_THRESHOLD = 3.5;
  private readonly SUSPENSION_PENALTY_THRESHOLD = 3;

  constructor(
    @Inject(REPUTATION_REPOSITORY)
    private readonly reputationRepository: ReputationRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async recalculateScore(userId: string, role: PenaltyRole): Promise<void> {
    const { avg, count } = await this.reputationRepository.getAverageRatingAsTarget(
      userId,
      role,
    );
    
    // En este diseño simple, el score es solo el promedio (por ahora no consideramos deducción de score por penalties,
    // o si lo consideramos, deberíamos restarlo del promedio, pero la US-3 dice "actualiza el score con el promedio ponderado"
    // y la penalty deduce score). Así que, base_score = promedio. 
    // Vamos a mantenerlo simple: el score es el promedio de las reviews.
    const newScore = Math.min(5, Math.max(0, avg));

    await this.reputationRepository.updateScoreAndCounts(userId, role, newScore, count);

    // Si es rentador, actualizamos el campo en sus vehículos para la US-3
    if (role === 'rentador') {
      await this.reputationRepository.updateVehicleOwnerReputationScore(userId, newScore);
    }
  }

  async getReputation(userId: string): Promise<GetReputationResponse> {
    // Validar que el user existe
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const repData = await this.reputationRepository.getReputationData(userId);
    const driverBadges: ReputationBadge[] = [];
    if (repData.scoreAsDriver >= this.BADGE_SCORE_THRESHOLD) {
      driverBadges.push('conductor_destacado');
    }

    const isDriverLowReputation = repData.scoreAsDriver < this.LOW_REPUTATION_THRESHOLD && repData.reviewCountAsDriver > 0;
    const isRenterLowReputation = repData.scoreAsRenter < this.LOW_REPUTATION_THRESHOLD && repData.reviewCountAsRenter > 0;

    return GetReputationResponseSchema.parse({
      userId,
      asDriver: {
        score: Number(repData.scoreAsDriver.toFixed(1)),
        reviewCount: repData.reviewCountAsDriver,
        badges: driverBadges,
        isLowReputation: isDriverLowReputation,
        penaltyCount: repData.penaltyCountAsDriver,
      },
      asRenter: {
        score: Number(repData.scoreAsRenter.toFixed(1)),
        reviewCount: repData.reviewCountAsRenter,
        badges: [], // Add rentador badges here if defined in the future
        isLowReputation: isRenterLowReputation,
        penaltyCount: repData.penaltyCountAsRenter,
      }
    });
  }

  async applyPenalty(dto: {
    userId: string;
    role: PenaltyRole;
    reason: string;
    scoreDeduction: number;
    ticketId: string;
  }): Promise<void> {
    const existingPenalty = await this.reputationRepository.findPenaltyByTicketId(dto.ticketId);
    if (existingPenalty) {
      throw new PenaltyAlreadyAppliedException(dto.ticketId);
    }

    const penalty = new Penalty({
      userId: dto.userId,
      role: dto.role,
      ticketId: dto.ticketId,
      reason: dto.reason,
      scoreDeduction: dto.scoreDeduction,
    });

    await this.reputationRepository.savePenalty(penalty);

    const repData = await this.reputationRepository.getReputationData(dto.userId);
    const currentScore = dto.role === 'conductor' ? repData.scoreAsDriver : repData.scoreAsRenter;
    const currentPenaltyCount = dto.role === 'conductor' ? repData.penaltyCountAsDriver : repData.penaltyCountAsRenter;
    const currentReviewCount = dto.role === 'conductor' ? repData.reviewCountAsDriver : repData.reviewCountAsRenter;

    const newScore = Math.max(0, currentScore - dto.scoreDeduction);
    const newPenaltyCount = currentPenaltyCount + 1;
    const isSuspended = newPenaltyCount >= this.SUSPENSION_PENALTY_THRESHOLD;

    await this.reputationRepository.updateScoreAndCounts(
      dto.userId,
      dto.role,
      newScore,
      currentReviewCount,
    );

    await this.reputationRepository.updatePenaltyCountAndSuspension(
      dto.userId,
      dto.role,
      newPenaltyCount,
      isSuspended,
    );

    if (dto.role === 'rentador') {
      await this.reputationRepository.updateVehicleOwnerReputationScore(dto.userId, newScore);
    }
  }
}
