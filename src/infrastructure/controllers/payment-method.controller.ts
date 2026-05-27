import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CreateSavedPaymentMethodSchema,
  UpdateSavedPaymentMethodSchema,
} from '@rocket-lease/contracts';
import { AuthService } from '@/application/auth.service';
import { PaymentMethodService } from '@/application/payment-method.service';

@Controller('profile/payment-methods')
export class PaymentMethodController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PaymentMethodService) private readonly paymentMethodService: PaymentMethodService,
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
  public async getMyPaymentMethods(@Headers('authorization') authorization?: string) {
    const userId = await this.resolveUserId(authorization);
    return this.paymentMethodService.getMyPaymentMethods(userId);
  }

  @Post()
  @HttpCode(201)
  public async createPaymentMethod(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    try {
      const userId = await this.resolveUserId(authorization);
      const dto = CreateSavedPaymentMethodSchema.parse(body);
      return await this.paymentMethodService.createPaymentMethod(userId, dto);
    } catch (error) {
      console.error('Error in createPaymentMethod:', error);
      throw error;
    }
  }

  @Patch(':id')
  @HttpCode(200)
  public async updatePaymentMethod(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const userId = await this.resolveUserId(authorization);
    const dto = UpdateSavedPaymentMethodSchema.parse(body);
    return this.paymentMethodService.updatePaymentMethod(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  public async deletePaymentMethod(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    const userId = await this.resolveUserId(authorization);
    await this.paymentMethodService.deletePaymentMethod(userId, id);
  }
}
