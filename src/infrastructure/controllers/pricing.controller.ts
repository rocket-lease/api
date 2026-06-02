import { Body, Controller, Inject, Post } from '@nestjs/common';
import * as Contracts from '@rocket-lease/contracts';
import { PricingService } from '@/application/pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(
    @Inject(PricingService) private readonly pricingService: PricingService,
  ) {}

  @Post('quote')
  async quote(
    @Body() dto: Contracts.PricingQuoteRequest,
  ): Promise<Contracts.PricingQuoteResponse> {
    const parsed = Contracts.PricingQuoteRequestSchema.parse(dto);
    return this.pricingService.quote(parsed);
  }
}