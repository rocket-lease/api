import { Inject, Injectable } from '@nestjs/common';
import {
  type CreateReviewRequest,
  type CreateReviewResponse,
  CreateReviewResponseSchema,
  type ReviewItem,
  type RentadorReviewsResponse,
  RentadorReviewsResponseSchema,
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

@Injectable()
export class ReviewService {
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: ReservationRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async createReview(
    conductorId: string,
    reservationId: string,
    dto: CreateReviewRequest,
  ): Promise<CreateReviewResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new EntityNotFoundException('Reservation', reservationId);
    }

    if (!reservation.isOwnedByConductor(conductorId)) {
      throw new EntityNotFoundException('Reservation', reservationId);
    }

    const reviewerProfile =
      await this.userRepository.getProfileById(conductorId);

    const review = new Review({
      reservationId,
      reviewerId: conductorId,
      reviewedId: reservation.getRentadorId(),
      targetType: dto.targetType,
      rating: dto.rating,
      comment: dto.comment,
    });

    const saved = await this.reviewRepository.save(review);

    return CreateReviewResponseSchema.parse({
      id: saved.getId(),
      reservationId: saved.getReservationId(),
      reviewerName: reviewerProfile?.name ?? '',
      targetType: saved.getTargetType(),
      rating: saved.getRating(),
      comment: saved.getComment(),
      createdAt: saved.getCreatedAt().toISOString(),
    });
  }

  async getRentadorReviews(
    reviewedId: string,
  ): Promise<RentadorReviewsResponse> {
    const reviews = await this.reviewRepository.findByReviewedId(reviewedId);

    if (reviews.length === 0) {
      return RentadorReviewsResponseSchema.parse([]);
    }

    const reviewerIds = [...new Set(reviews.map((r) => r.getReviewerId()))];
    const profiles = await this.userRepository.findProfilesByIds(reviewerIds);
    const nameByReviewerId = new Map(
      profiles.map((p) => [p.id, p.name]),
    );

    return RentadorReviewsResponseSchema.parse(
      reviews.map((review) => ({
        id: review.getId(),
        reservationId: review.getReservationId(),
        reviewerName: nameByReviewerId.get(review.getReviewerId()) ?? '',
        targetType: review.getTargetType(),
        rating: review.getRating(),
        comment: review.getComment(),
        createdAt: review.getCreatedAt().toISOString(),
      })),
    );
  }

  async getReservationReview(
    reservationId: string,
  ): Promise<ReviewItem | null> {
    const review =
      await this.reviewRepository.findByReservationId(reservationId);
    if (!review) return null;

    const reviewerProfile =
      await this.userRepository.getProfileById(review.getReviewerId());

    return {
      id: review.getId(),
      reservationId: review.getReservationId(),
      reviewerName: reviewerProfile?.name ?? '',
      targetType: review.getTargetType(),
      rating: review.getRating(),
      comment: review.getComment(),
      createdAt: review.getCreatedAt().toISOString(),
    };
  }
}
