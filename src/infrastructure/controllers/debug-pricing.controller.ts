import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import * as Contracts from '@rocket-lease/contracts';
import { AdminGuard } from '@/infrastructure/auth/admin.guard';
import { DebugPricingService } from '@/application/admin/debug-pricing.service';

/**
 * Endpoints del panel de debug del pricing. Solo responden cuando
 * `PRICING_DEBUG_ENABLED` está activo (el service tira 404 si no); igual van
 * detrás de `AdminGuard`. Sirven para fabricar demanda y ver el heatmap
 * reaccionar sin tener que generar tráfico real.
 */
@Controller('admin/pricing/debug')
@UseGuards(AdminGuard)
export class DebugPricingController {
  constructor(private readonly debugPricingService: DebugPricingService) {}

  @Post('emit')
  public async emit(
    @Body() dto: Contracts.EmitDebugSignalsRequest,
  ): Promise<Contracts.EmitDebugSignalsResponse> {
    const parsed = Contracts.EmitDebugSignalsRequestSchema.parse(dto);
    return this.debugPricingService.emit(parsed);
  }

  @Delete()
  public async clear(): Promise<Contracts.ClearDebugDataResponse> {
    return this.debugPricingService.clear();
  }
}
