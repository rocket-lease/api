import { Injectable, Inject } from '@nestjs/common';
import { Review } from '@/domain/entities/review.entity';
import type { ReviewRepository } from '@/domain/repositories/review.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class PostgresReviewRepository implements ReviewRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private reconstitute(row: {
    id: string;
    reservationId: string;
    reviewerId: string;
    reviewedId: string;
    targetType: string;
    rating: number;
    comment: string;
    createdAt: Date;
  }): Review {
    return new Review({
      id: row.id,
      reservationId: row.reservationId,
      reviewerId: row.reviewerId,
      reviewedId: row.reviewedId,
      targetType: row.targetType as 'vehicle' | 'rentador',
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt,
    });
  }

  async save(review: Review): Promise<Review> {
    const row = await this.prisma.review.create({
      data: {
        id: review.getId(),
        reservationId: review.getReservationId(),
        reviewerId: review.getReviewerId(),
        reviewedId: review.getReviewedId(),
        targetType: review.getTargetType(),
        rating: review.getRating(),
        comment: review.getComment(),
        createdAt: review.getCreatedAt(),
      },
    });
    return this.reconstitute(row);
  }

  async findByReservationId(reservationId: string): Promise<Review | null> {
    const row = await this.prisma.review.findUnique({
      where: { reservationId },
    });
    return row ? this.reconstitute(row) : null;
  }

  async findByReviewedId(reviewedId: string): Promise<Review[]> {
    const rows = await this.prisma.review.findMany({
      where: { reviewedId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.reconstitute(r));
  }
}
