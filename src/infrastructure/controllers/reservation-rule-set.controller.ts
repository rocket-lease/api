import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import * as Contracts from '@rocket-lease/contracts';
import { AuthService } from '@/application/auth.service';
import { ReservationRuleSetService } from '@/application/reservation-rule-set.service';

@Controller('reservation-rules')
export class ReservationRuleSetController {
  constructor(
    private readonly authService: AuthService,
    private readonly reservationRuleSetService: ReservationRuleSetService,
  ) {}

  private async resolveUserId(authorization?: string): Promise<string> {
    if (!authorization) {
      throw new UnauthorizedException('Missing authorization header');
    }

    try {
      return await this.authService.getUserIdFromToken(authorization);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  @Get()
  public async listMine(@Headers('authorization') authorization?: string) {
    const userId = await this.resolveUserId(authorization);
    return this.reservationRuleSetService.listRuleSets(userId);
  }

  @Get(':id')
  public async getById(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    const userId = await this.resolveUserId(authorization);
    return this.reservationRuleSetService.getRuleSetById(userId, id);
  }

  @Post()
  public async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Contracts.CreateReservationRuleSetRequest,
  ) {
    const userId = await this.resolveUserId(authorization);
    return this.reservationRuleSetService.createRuleSet(userId, body);
  }

  @Patch(':id')
  public async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: Contracts.UpdateReservationRuleSetRequest,
  ) {
    const userId = await this.resolveUserId(authorization);
    return this.reservationRuleSetService.updateRuleSet(userId, id, body);
  }

  @Delete(':id')
  public async delete(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    const userId = await this.resolveUserId(authorization);
    await this.reservationRuleSetService.deleteRuleSet(userId, id);
  }
}