import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import * as Contracts from '@rocket-lease/contracts';
import { AuthService } from '@/application/auth.service';
import { PricingService } from '@/application/pricing/pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(
    @Inject(PricingService)
    private readonly pricingService: PricingService,
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  /**
   * Cotiza el precio de un alquiler. El header `Authorization` es opcional:
   * si está presente y válido, el quote queda asociado al conductor y solo
   * ese conductor puede usar el `quoteToken` al crear la reserva.
   */
  @Post('quote')
  public async quote(
    @Body() dto: Contracts.PricingQuoteRequest,
    @Headers('authorization') authHeader?: string,
  ): Promise<Contracts.PricingQuoteResponse> {
    const parsed = Contracts.PricingQuoteRequestSchema.parse(dto);
    const conductorId = await this.tryGetConductorId(authHeader);
    return this.pricingService.quote(parsed, conductorId);
  }

  private async tryGetConductorId(
    authHeader: string | undefined,
  ): Promise<string | null> {
    if (!authHeader) return null;
    try {
      return await this.authService.getUserIdFromToken(authHeader);
    } catch {
      return null;
    }
  }
}
