import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  ListNotificationsResponse,
  UnreadCountResponse,
} from '@rocket-lease/contracts';
import { AuthService } from '@/application/auth.service';
import { NotificationService } from '@/application/notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(NotificationService) private readonly notificationService: NotificationService,
  ) {}

  private async resolveUserId(authorization?: string): Promise<string> {
    if (!authorization) throw new UnauthorizedException('Missing authorization header');
    try {
      return await this.authService.getUserIdFromToken(authorization);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  @Get()
  @HttpCode(200)
  async list(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<ListNotificationsResponse> {
    const userId = await this.resolveUserId(authorization);
    return this.notificationService.list(userId);
  }

  @Get('unread-count')
  @HttpCode(200)
  async unreadCount(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<UnreadCountResponse> {
    const userId = await this.resolveUserId(authorization);
    return this.notificationService.unreadCount(userId);
  }

  @Post('read-all')
  @HttpCode(200)
  async markAllRead(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<UnreadCountResponse> {
    const userId = await this.resolveUserId(authorization);
    return this.notificationService.markAllRead(userId);
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<UnreadCountResponse> {
    const userId = await this.resolveUserId(authorization);
    return this.notificationService.markRead(userId, id);
  }
}
