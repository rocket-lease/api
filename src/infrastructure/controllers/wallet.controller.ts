import { Body, Controller, Get, Headers, HttpCode, Inject, Post, UnauthorizedException } from '@nestjs/common';
import * as Contracts from '@rocket-lease/contracts';
import { AuthService } from '@/application/auth.service';
import { WalletService } from '@/application/wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(WalletService) private readonly walletService: WalletService,
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

  @Get('balance')
  @HttpCode(200)
  async balance(@Headers('authorization') authorization?: string): Promise<Contracts.WalletBalance> {
    const userId = await this.resolveUserId(authorization);
    return this.walletService.getBalance(userId);
  }

  @Get('transactions')
  @HttpCode(200)
  async transactions(@Headers('authorization') authorization?: string): Promise<Contracts.WalletTransactionsResponse> {
    const userId = await this.resolveUserId(authorization);
    return this.walletService.getTransactions(userId);
  }

  @Post('withdrawals')
  @HttpCode(201)
  async withdraw(
    @Body() body: Contracts.WithdrawRequest,
    @Headers('authorization') authorization?: string,
  ): Promise<Contracts.WithdrawResponse> {
    const userId = await this.resolveUserId(authorization);
    const dto = Contracts.WithdrawRequestSchema.parse(body);
    return this.walletService.withdraw(userId, dto);
  }
}