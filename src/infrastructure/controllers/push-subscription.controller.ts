import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { RegisterPushSubscriptionRequestSchema, UnregisterPushSubscriptionRequestSchema } from '@rocket-lease/contracts';
import { AuthService } from '@/application/auth.service';
import { PushSubscriptionService } from '@/application/push-subscription.service';

@Controller('push-subscriptions')
export class PushSubscriptionController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PushSubscriptionService) private readonly pushService: PushSubscriptionService,
  ) {}

  private async resolveUserId(authorization?: string): Promise<string> {
    if (!authorization) throw new UnauthorizedException('Missing authorization header');
    try {
      return await this.authService.getUserIdFromToken(authorization);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  @Get('vapid-key')
  @HttpCode(200)
  getVapidKey() {
    return { publicKey: this.pushService.getVapidPublicKey() };
  }

  @Post()
  @HttpCode(201)
  async register(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): Promise<void> {
    const userId = await this.resolveUserId(authorization);
    const dto = RegisterPushSubscriptionRequestSchema.parse(body);
    await this.pushService.register(userId, dto);
  }

  @Delete()
  @HttpCode(204)
  async unregister(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): Promise<void> {
    await this.resolveUserId(authorization);
    const dto = UnregisterPushSubscriptionRequestSchema.parse(body);
    await this.pushService.unregister(dto.endpoint);
  }
}
