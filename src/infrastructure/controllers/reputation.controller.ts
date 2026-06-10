import { Controller, Get, HttpCode, Inject, Param } from '@nestjs/common';
import { ReputationService } from '@/application/reputation.service';
import type { GetReputationResponse } from '@rocket-lease/contracts';

@Controller('reputation')
export class ReputationController {
  constructor(
    @Inject(ReputationService)
    private readonly reputationService: ReputationService,
  ) {}

  @Get(':userId')
  @HttpCode(200)
  async getReputation(
    @Param('userId') userId: string,
  ): Promise<GetReputationResponse> {
    return this.reputationService.getReputation(userId);
  }
}
