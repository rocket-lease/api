import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const reviewSchema = z.object({
  id: z.string().uuid(),
  reservationId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  reviewedId: z.string().uuid(),
  targetType: z.enum(['vehicle', 'rentador']),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500, 'Comment must be at most 500 characters'),
  createdAt: z.date(),
});

export type ReviewTargetType = 'vehicle' | 'rentador';

export interface ReviewProps {
  id?: string;
  reservationId: string;
  reviewerId: string;
  reviewedId: string;
  targetType: ReviewTargetType;
  rating: number;
  comment: string;
  createdAt?: Date;
}

export class Review {
  private readonly id: string;
  private readonly reservationId: string;
  private readonly reviewerId: string;
  private readonly reviewedId: string;
  private readonly targetType: ReviewTargetType;
  private readonly rating: number;
  private readonly comment: string;
  private readonly createdAt: Date;

  constructor(props: ReviewProps) {
    this.id = props.id ?? randomUUID();
    this.reservationId = props.reservationId;
    this.reviewerId = props.reviewerId;
    this.reviewedId = props.reviewedId;
    this.targetType = props.targetType;
    this.rating = props.rating;
    this.comment = props.comment;
    this.createdAt = props.createdAt ?? new Date();
    this.validate();
  }

  public getId(): string {
    return this.id;
  }

  public getReservationId(): string {
    return this.reservationId;
  }

  public getReviewerId(): string {
    return this.reviewerId;
  }

  public getReviewedId(): string {
    return this.reviewedId;
  }

  public getTargetType(): ReviewTargetType {
    return this.targetType;
  }

  public getRating(): number {
    return this.rating;
  }

  public getComment(): string {
    return this.comment;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  private validate(): void {
    const result = reviewSchema.safeParse({
      id: this.id,
      reservationId: this.reservationId,
      reviewerId: this.reviewerId,
      reviewedId: this.reviewedId,
      targetType: this.targetType,
      rating: this.rating,
      comment: this.comment,
      createdAt: this.createdAt,
    });
    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }
}
