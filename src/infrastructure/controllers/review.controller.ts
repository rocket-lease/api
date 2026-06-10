import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import type { RentadorReviewsResponse } from '@rocket-lease/contracts';
import { ReviewService } from '@/application/review.service';
import { AuthService } from '@/application/auth.service';

@Controller('reviews')
export class ReviewController {
  constructor(
    @Inject(ReviewService) private readonly reviewService: ReviewService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  private async resolveUserId(
    authHeader: string | undefined,
  ): Promise<string> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    try {
      return await this.authService.getUserIdFromToken(authHeader);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token', {
        cause: error,
      });
    }
  }

  @Get('rentador/mine')
  @HttpCode(200)
  async getRentadorReviews(
    @Headers('authorization') authHeader: string | undefined,
  ): Promise<RentadorReviewsResponse> {
    const userId = await this.resolveUserId(authHeader);
    return this.reviewService.getRentadorReviews(userId);
  }

  @Get('conductor/mine')
  @HttpCode(200)
  async getConductorReviews(
    @Headers('authorization') authHeader: string | undefined,
  ): Promise<RentadorReviewsResponse> {
    const userId = await this.resolveUserId(authHeader);
    return this.reviewService.getConductorReviews(userId);
  }

  @Get('vehicle/:vehicleId')
  @HttpCode(200)
  async getVehicleReviews(
    @Param('vehicleId') vehicleId: string,
  ): Promise<RentadorReviewsResponse> {
    return this.reviewService.getVehicleReviews(vehicleId);
  }

  @Get('user/:userId')
  @HttpCode(200)
  async getUserReviews(
    @Param('userId') userId: string,
  ): Promise<RentadorReviewsResponse> {
    return this.reviewService.getUserReviews(userId);
  }
}
