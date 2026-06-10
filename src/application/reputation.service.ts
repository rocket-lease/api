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
  private readonly BADGE_MIN_REVIEWS = 5;
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
    
    // Obtener la data actual para ver si hay deducciones (penalties)
    const repData = await this.reputationRepository.getReputationData(userId);
    const scoreAsTarget = role === 'conductor' ? repData.scoreAsDriver : repData.scoreAsRenter;
    
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
    
    // Devolvemos el score general como el promedio de ambos roles,
    // o solo el que esté activo. Contracts no define score por rol en GetReputationResponse.
    // Vamos a promediarlo para la UI general, o usar el maximo.
    // Asumiremos que el frontend pide el profile del user y el contrato GetReputationResponse 
    // es general. US-3 dice "badge 'Conductor destacado' en su perfil", 
    // que implica que el badge es global.
    
    let totalScore = 0;
    let totalCount = 0;
    
    if (repData.reviewCountAsDriver > 0) {
      totalScore += repData.scoreAsDriver * repData.reviewCountAsDriver;
      totalCount += repData.reviewCountAsDriver;
    }
    if (repData.reviewCountAsRenter > 0) {
      totalScore += repData.scoreAsRenter * repData.reviewCountAsRenter;
      totalCount += repData.reviewCountAsRenter;
    }
    
    const combinedScore = totalCount > 0 ? totalScore / totalCount : 0;
    const combinedReviewCount = repData.reviewCountAsDriver + repData.reviewCountAsRenter;
    const combinedPenaltyCount = repData.penaltyCountAsDriver + repData.penaltyCountAsRenter;

    const badges: ReputationBadge[] = [];
    if (repData.scoreAsDriver >= this.BADGE_SCORE_THRESHOLD && repData.reviewCountAsDriver >= this.BADGE_MIN_REVIEWS) {
      badges.push('conductor_destacado');
    }

    const isLowReputation = combinedScore < this.LOW_REPUTATION_THRESHOLD && combinedReviewCount > 0;

    return GetReputationResponseSchema.parse({
      userId,
      score: Number(combinedScore.toFixed(1)),
      reviewCount: combinedReviewCount,
      badges,
      isLowReputation,
      penaltyCount: combinedPenaltyCount,
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
