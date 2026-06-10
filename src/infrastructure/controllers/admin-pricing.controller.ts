import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import * as Contracts from '@rocket-lease/contracts';
import { AdminPricingService } from '@/application/admin/admin-pricing.service';
import { AdminGuard } from '@/infrastructure/auth/admin.guard';

@Controller('admin/pricing')
@UseGuards(AdminGuard)
export class AdminPricingController {
  constructor(
    @Inject(AdminPricingService)
    private readonly adminPricingService: AdminPricingService,
  ) {}

  @Get('zones')
  public async getZones(): Promise<Contracts.AdminPricingZonesResponse> {
    return this.adminPricingService.aggregateZones();
  }
}
