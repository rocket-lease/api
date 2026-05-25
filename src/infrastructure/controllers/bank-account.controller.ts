import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import * as Contracts from '@rocket-lease/contracts';
import { AuthService } from '@/application/auth.service';
import { BankAccountService } from '@/application/bank-account.service';

@Controller('bank-accounts')
export class BankAccountController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(BankAccountService) private readonly bankAccountService: BankAccountService,
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
  @HttpCode(200)
  async listMine(@Headers('authorization') authorization?: string): Promise<Contracts.BankAccountListResponse> {
    const userId = await this.resolveUserId(authorization);
    return this.bankAccountService.listMine(userId);
  }

  @Post()
  @HttpCode(201)
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Contracts.CreateBankAccountRequest,
  ): Promise<Contracts.CreateBankAccountResponse> {
    const userId = await this.resolveUserId(authorization);
    const dto = Contracts.CreateBankAccountRequestSchema.parse(body);
    return this.bankAccountService.createBankAccount(userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<void> {
    const userId = await this.resolveUserId(authorization);
    await this.bankAccountService.deleteBankAccount(userId, id);
  }
}