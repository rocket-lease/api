import { Inject, Injectable } from '@nestjs/common';
import {
  type CreateReviewRequest,
  type CreateReviewResponse,
  CreateReviewResponseSchema,
  type ReviewItem,
  type RentadorReviewsResponse,
  type LevelUpInfo,
} from '@rocket-lease/contracts';
import { Review } from '@/domain/entities/review.entity';
import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
} from '@/domain/repositories/review.repository';
import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '@/domain/repositories/reservation.repository';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';
import { ReputationService } from '@/application/reputation.service';
import { LoyaltyService } from '@/application/loyalty.service';
import type { NotificationProvider } from '@/domain/providers/notification.provider';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';

@Injectable()
export class ReviewService {
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: ReservationRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ReputationService)
    private readonly reputationService: ReputationService,
    @Inject(LoyaltyService)
    private readonly loyaltyService: LoyaltyService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
  ) {}

  /**
   * Crea una reseña para una reserva completada.
   *
   * Permite que tanto el conductor como el rentador de la reserva creen
   * una reseña. Valida que:
   * - La reserva exista y esté en estado `completed`.
   * - El reviewer sea parte de la reserva (conductor o rentador).
   * - No exista ya una reseña del mismo reviewer para la misma reserva.
   *
   * El `reviewedId` se determina según el `targetType`:
   * - `'vehicle'` → ID del vehículo de la reserva
   * - `'rentador'` → ID del rentador de la reserva
   * - `'conductor'` → ID del conductor de la reserva
   */
  async createReview(
    reviewerId: string,
    reservationId: string,
    dto: CreateReviewRequest,
  ): Promise<CreateReviewResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new EntityNotFoundException('Reservation', reservationId);
    }

    // Solo reservas completadas pueden ser reseñadas
    if (!reservation.isCompleted()) {
      throw new InvalidEntityDataException(
        'Solo se pueden reseñar reservas completadas',
      );
    }

    // El reviewer debe ser parte de la reserva
    if (
      !reservation.isOwnedByConductor(reviewerId) &&
      !reservation.isOwnedByRentador(reviewerId)
    ) {
      throw new EntityNotFoundException('Reservation', reservationId);
    }

    // Chequear que no exista ya una reseña del mismo targetType
    const existing =
      await this.reviewRepository.findByReservationAndReviewerAndTargetType(
        reservationId,
        reviewerId,
        dto.targetType,
      );
    if (existing) {
      throw new InvalidEntityDataException(
        'Ya existe una reseña tuya con ese tipo para esta reserva',
      );
    }

    // Determinar reviewedId según targetType
    let reviewedId: string;
    switch (dto.targetType) {
      case 'vehicle':
        reviewedId = reservation.getVehicleId();
        break;
      case 'rentador':
        reviewedId = reservation.getRentadorId();
        break;
      case 'conductor':
        reviewedId = reservation.getConductorId();
        break;
      default:
        throw new InvalidEntityDataException(
          `Tipo de reseña inválido: ${String(dto.targetType)}`,
        );
    }

    const reviewerProfile = await this.userRepository.getProfileById(reviewerId);

    const review = new Review({
      reservationId,
      reviewerId,
      reviewedId,
      targetType: dto.targetType,
      rating: dto.rating,
      comment: dto.comment,
    });

    const saved = await this.reviewRepository.save(review);

    const recipientId =
      dto.targetType === 'conductor'
        ? reservation.getConductorId()
        : reservation.getRentadorId();
    if (recipientId !== reviewerId) {
      const reviewerName = reviewerProfile?.name ?? 'Alguien';
      const body =
        dto.targetType === 'vehicle'
          ? `${reviewerName} reseñó tu vehículo (${dto.rating}★).`
          : `${reviewerName} te dejó una reseña (${dto.rating}★).`;
      void this.notificationProvider.notify(recipientId, 'Nueva reseña', body, {
        url: `/reservas/${reservationId}`,
      });
    }

    let levelUp: LevelUpInfo | null = null;
    if (dto.targetType === 'conductor' || dto.targetType === 'vehicle') {
      try {
        levelUp = await this.loyaltyService.claimXpFromReview(reviewerId, reservationId);
      } catch {
        // fail silently
      }
    }

    const response = CreateReviewResponseSchema.parse({
      id: saved.getId(),
      reservationId: saved.getReservationId(),
      reviewerId,
      reviewerName: reviewerProfile?.name ?? '',
      targetType: saved.getTargetType(),
      rating: saved.getRating(),
      vehicleRating: null,
      comment: saved.getComment(),
      createdAt: saved.getCreatedAt().toISOString(),
      levelUp,
    });

    // Recalcular reputacion asincronamente (falla silenciosa para no romper flujo)
    if (dto.targetType === 'conductor' || dto.targetType === 'rentador') {
      const role = dto.targetType;
      this.reputationService.recalculateScore(reviewedId, role).catch(console.error);
    }

    return response;
  }

  /**
   * Retorna las reseñas recibidas por un rentador:
   * - reseñas sobre el rentador (targetType='rentador')
   * - reseñas sobre vehículos del rentador (targetType='vehicle').
   */
  async getRentadorReviews(
    rentadorId: string,
  ): Promise<RentadorReviewsResponse> {
    const [directReviews, vehicleReviews] = await Promise.all([
      this.reviewRepository.findByTarget('rentador', rentadorId),
      this.reviewRepository.findVehicleReviewsByRentadorId(rentadorId),
    ]);

    const allReviews = [...directReviews, ...vehicleReviews];

    if (allReviews.length === 0) {
      return [];
    }

    const reviewerIds = [...new Set(allReviews.map((r) => r.getReviewerId()))];
    const profiles = await this.userRepository.findProfilesByIds(reviewerIds);
    const nameByReviewerId = new Map(
      profiles.map((p) => [p.id, p.name]),
    );

    return allReviews.map((review) => ({
      id: review.getId(),
      reservationId: review.getReservationId(),
      reviewerId: review.getReviewerId(),
      reviewerName: nameByReviewerId.get(review.getReviewerId()) ?? '',
      targetType: review.getTargetType(),
      rating: review.getRating(),
      vehicleRating: null,
      comment: review.getComment(),
      createdAt: review.getCreatedAt().toISOString(),
    }));
  }

  /**
   * Retorna las reseñas recibidas por un conductor
   * (targetType='conductor').
   */
  async getConductorReviews(
    reviewedId: string,
  ): Promise<RentadorReviewsResponse> {
    const reviews = await this.reviewRepository.findByTarget(
      'conductor',
      reviewedId,
    );

    if (reviews.length === 0) {
      return [];
    }

    const reviewerIds = [...new Set(reviews.map((r) => r.getReviewerId()))];
    const profiles = await this.userRepository.findProfilesByIds(reviewerIds);
    const nameByReviewerId = new Map(
      profiles.map((p) => [p.id, p.name]),
    );

    return reviews.map((review) => ({
      id: review.getId(),
      reservationId: review.getReservationId(),
      reviewerId: review.getReviewerId(),
      reviewerName: nameByReviewerId.get(review.getReviewerId()) ?? '',
      targetType: review.getTargetType(),
      rating: review.getRating(),
      vehicleRating: null,
      comment: review.getComment(),
      createdAt: review.getCreatedAt().toISOString(),
    }));
  }

  /**
   * Retorna las reseñas de un vehículo específico.
   */
  async getVehicleReviews(
    vehicleId: string,
  ): Promise<RentadorReviewsResponse> {
    const reviews = await this.reviewRepository.findByTarget(
      'vehicle',
      vehicleId,
    );

    if (reviews.length === 0) {
      return [];
    }

    const reviewerIds = [...new Set(reviews.map((r) => r.getReviewerId()))];
    const profiles = await this.userRepository.findProfilesByIds(reviewerIds);
    const nameByReviewerId = new Map(
      profiles.map((p) => [p.id, p.name]),
    );

    return reviews.map((review) => ({
      id: review.getId(),
      reservationId: review.getReservationId(),
      reviewerId: review.getReviewerId(),
      reviewerName: nameByReviewerId.get(review.getReviewerId()) ?? '',
      targetType: review.getTargetType(),
      rating: review.getRating(),
      vehicleRating: null,
      comment: review.getComment(),
      createdAt: review.getCreatedAt().toISOString(),
    }));
  }

  /**
   * Retorna todas las reseñas públicas de un usuario.
   * Incluye reseñas donde el usuario fue reseñado directamente
   * (targetType='rentador' o 'conductor').
   */
  async getUserReviews(userId: string): Promise<RentadorReviewsResponse> {
    const reviews = await this.reviewRepository.findByReviewedId(userId);

    if (reviews.length === 0) {
      return [];
    }

    const reviewerIds = [...new Set(reviews.map((r) => r.getReviewerId()))];
    const profiles = await this.userRepository.findProfilesByIds(reviewerIds);
    const nameByReviewerId = new Map(
      profiles.map((p) => [p.id, p.name]),
    );

    return reviews.map((review) => ({
      id: review.getId(),
      reservationId: review.getReservationId(),
      reviewerId: review.getReviewerId(),
      reviewerName: nameByReviewerId.get(review.getReviewerId()) ?? '',
      targetType: review.getTargetType(),
      rating: review.getRating(),
      vehicleRating: null,
      comment: review.getComment(),
      createdAt: review.getCreatedAt().toISOString(),
    }));
  }

  /**
   * Retorna todas las reseñas de una reserva (sin filtrar por usuario).
   */
  async getReservationReviewsByUser(
    reservationId: string,
    _userId: string,
  ): Promise<ReviewItem[]> {
    const reviews =
      await this.reviewRepository.findAllByReservationId(reservationId);
    if (reviews.length === 0) return [];

    const reviewerIds = [...new Set(reviews.map((r) => r.getReviewerId()))];
    const profiles = await this.userRepository.findProfilesByIds(reviewerIds);
    const nameByReviewerId = new Map(
      profiles.map((p) => [p.id, p.name]),
    );

    return reviews.map((review) => ({
      id: review.getId(),
      reservationId: review.getReservationId(),
      reviewerId: review.getReviewerId(),
      reviewerName: nameByReviewerId.get(review.getReviewerId()) ?? '',
      targetType: review.getTargetType(),
      rating: review.getRating(),
      vehicleRating: null,
      comment: review.getComment(),
      createdAt: review.getCreatedAt().toISOString(),
    }));
  }
}
