import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Inject,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PromotionService } from '@/application/promotion.service';
import { AuthService } from '@/application/auth.service';
import { VehicleAlreadyPromoted } from '@/domain/exceptions/promotion.exception';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import type {
  PromotionDurationsResponse,
  PromoteVehicleRequest,
  PromoteVehicleResponse,
  GetPromotionResponse,
} from '@rocket-lease/contracts';
import type { Request } from 'express';

@Controller('promotion')
export class PromotionPlansController {
  constructor(
    @Inject(PromotionService) private readonly promotionService: PromotionService,
  ) {}

  @Get('durations')
  async getDurations(): Promise<PromotionDurationsResponse> {
    return await this.promotionService.getDurations();
  }
}

@Controller('vehicle/:vehicleId/promotion')
export class VehiclePromotionController {
  constructor(
    @Inject(PromotionService) private readonly promotionService: PromotionService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  private async resolveUserId(req: Request): Promise<string> {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('Token not found');
    try {
      return await this.authService.getUserIdFromToken(authHeader);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  @Post()
  async promoteVehicle(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: PromoteVehicleRequest,
    @Req() req: Request,
  ): Promise<PromoteVehicleResponse> {
    const ownerId = await this.resolveUserId(req);
    try {
      return await this.promotionService.promoteVehicle(ownerId, vehicleId, dto);
    } catch (e) {
      if (e instanceof VehicleAlreadyPromoted) {
        throw new ConflictException('Vehicle is already promoted');
      }
      if (e instanceof EntityNotFoundException) {
        throw new NotFoundException(e.message);
      }
      throw e;
    }
  }

  @Get()
  async getPromotion(
    @Param('vehicleId') vehicleId: string,
  ): Promise<GetPromotionResponse> {
    return await this.promotionService.getVehiclePromotion(vehicleId);
  }
}
