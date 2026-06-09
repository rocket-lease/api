import { Injectable, Inject } from '@nestjs/common';
import { Review, type ReviewTargetType } from '@/domain/entities/review.entity';
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
      targetType: row.targetType as ReviewTargetType,
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
    const row = await this.prisma.review.findFirst({
      where: { reservationId },
      orderBy: { createdAt: 'desc' },
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

  async findByReviewerId(reviewerId: string): Promise<Review[]> {
    const rows = await this.prisma.review.findMany({
      where: { reviewerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.reconstitute(r));
  }

  async findByReservationAndReviewer(
    reservationId: string,
    reviewerId: string,
  ): Promise<Review | null> {
    const row = await this.prisma.review.findFirst({
      where: { reservationId, reviewerId },
    });
    return row ? this.reconstitute(row) : null;
  }

  async findByReservationAndReviewerAndTargetType(
    reservationId: string,
    reviewerId: string,
    targetType: ReviewTargetType,
  ): Promise<Review | null> {
    const row = await this.prisma.review.findFirst({
      where: { reservationId, reviewerId, targetType },
    });
    return row ? this.reconstitute(row) : null;
  }

  async findByReservationAndReviewerAll(
    reservationId: string,
    reviewerId: string,
  ): Promise<Review[]> {
    const rows = await this.prisma.review.findMany({
      where: { reservationId, reviewerId },
    });
    return rows.map((r) => this.reconstitute(r));
  }

  async findByTarget(
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<Review[]> {
    const rows = await this.prisma.review.findMany({
      where: { targetType, reviewedId: targetId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.reconstitute(r));
  }

  async findAllByReservationId(reservationId: string): Promise<Review[]> {
    const rows = await this.prisma.review.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.reconstitute(r));
  }

  async findVehicleReviewsByRentadorId(rentadorId: string): Promise<Review[]> {
    const rows = await this.prisma.review.findMany({
      where: {
        targetType: 'vehicle',
        reservation: { rentadorId },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.reconstitute(r));
  }
}
