import { Review } from '../entities/review.entity';

export interface ReviewRepository {
  save(review: Review): Promise<Review>;
  findByReservationId(reservationId: string): Promise<Review | null>;
  findByReviewedId(reviewedId: string): Promise<Review[]>;
}

export const REVIEW_REPOSITORY = Symbol('ReviewRepository');
