import { Review, type ReviewTargetType } from '../entities/review.entity';

export interface ReviewRepository {
  save(review: Review): Promise<Review>;
  findByReservationId(reservationId: string): Promise<Review | null>;
  findByReviewedId(reviewedId: string): Promise<Review[]>;
  findByReviewerId(reviewerId: string): Promise<Review[]>;
  findByReservationAndReviewer(
    reservationId: string,
    reviewerId: string,
  ): Promise<Review | null>;
  findByReservationAndReviewerAndTargetType(
    reservationId: string,
    reviewerId: string,
    targetType: ReviewTargetType,
  ): Promise<Review | null>;
  findByReservationAndReviewerAll(
    reservationId: string,
    reviewerId: string,
  ): Promise<Review[]>;
  findAllByReservationId(reservationId: string): Promise<Review[]>;
  findByTarget(
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<Review[]>;
  /** Retorna reseñas de vehículos (targetType='vehicle') cuyas reservas
   *  pertenecen al rentador indicado. */
  findVehicleReviewsByRentadorId(rentadorId: string): Promise<Review[]>;
}

export const REVIEW_REPOSITORY = Symbol('ReviewRepository');
