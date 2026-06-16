import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '@/application/auth.service';
import { LoyaltyService } from '@/application/loyalty.service';
import type { LoyaltyProfile, ExperienceTransaction } from '@rocket-lease/contracts';

@Controller('loyalty')
export class LoyaltyController {
  constructor(
    @Inject(LoyaltyService) private readonly loyaltyService: LoyaltyService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Get('me')
  @HttpCode(200)
  async getMyProfile(@Req() req: Request): Promise<LoyaltyProfile> {
    const userId = await this.requireUserId(req);
    return this.loyaltyService.getProfile(userId) as Promise<LoyaltyProfile>;
  }

  @Get('me/transactions')
  @HttpCode(200)
  async getMyTransactions(@Req() req: Request): Promise<ExperienceTransaction[]> {
    const userId = await this.requireUserId(req);
    const txs = await this.loyaltyService.getTransactions(userId);
    return txs.map((tx) => {
      const snapshot = tx.getReservationSnapshot();
      return {
        id: tx.getId(),
        amount: tx.getAmount(),
        status: tx.getStatus() as 'pending' | 'claimed',
        createdAt: tx.getCreatedAt().toISOString(),
        reservation: {
          id: snapshot.id,
          vehicleName: snapshot.vehicleName,
          vehicleId: snapshot.vehicleId,
          startAt: snapshot.startAt.toISOString(),
          endAt: snapshot.endAt.toISOString(),
        },
      } satisfies ExperienceTransaction;
    });
  }

  @Get('user/:userId')
  @HttpCode(200)
  async getUserLevel(
    @Param('userId') userId: string,
  ): Promise<{ level: string }> {
    return this.loyaltyService.getPublicLevel(userId);
  }

  private async requireUserId(req: Request): Promise<string> {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('Token not found');
    try {
      return await this.authService.getUserIdFromToken(authHeader);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
