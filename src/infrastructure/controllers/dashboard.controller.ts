import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '@/application/auth.service';
import { DashboardService } from '@/application/dashboard.service';
import * as Contracts from '@rocket-lease/contracts';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @Inject(DashboardService)
    private readonly dashboardService: DashboardService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Get('metrics')
  async getMetrics(
    @Query('period') period: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: Request,
  ): Promise<Contracts.DashboardSummaryResponse> {
    const rentadorId = await this.requireUserId(req);
    const parsed = Contracts.DashboardSummaryRequestSchema.parse({
      period,
      from,
      to,
    });
    return this.dashboardService.getSummary(rentadorId, parsed.period, {
      from: parsed.from,
      to: parsed.to,
    });
  }

  @Get('vehicles/:id/metrics')
  async getVehicleMetrics(
    @Param('id') id: string,
    @Query('period') period: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: Request,
  ): Promise<Contracts.DashboardVehicleDetailResponse> {
    const rentadorId = await this.requireUserId(req);
    const parsed = Contracts.DashboardSummaryRequestSchema.parse({
      period,
      from,
      to,
    });
    return this.dashboardService.getVehicleDetail(rentadorId, id, parsed.period, {
      from: parsed.from,
      to: parsed.to,
    });
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
