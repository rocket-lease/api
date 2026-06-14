import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SendMessageRequestSchema,
  MarkReadBodySchema,
  type SendMessageResponse,
  type ListMessagesResponse,
} from '@rocket-lease/contracts';
import { MessagingService } from '@/application/messaging.service';
import { AuthService } from '@/application/auth.service';

@Controller('reservations/:reservationId/messages')
export class MessagingController {
  constructor(
    @Inject(MessagingService)
    private readonly messagingService: MessagingService,
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  private async resolveUserId(
    authHeader: string | undefined,
  ): Promise<string> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    try {
      return await this.authService.getUserIdFromToken(authHeader);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token', {
        cause: error,
      });
    }
  }

  @Post()
  @HttpCode(201)
  async send(
    @Headers('authorization') auth: string | undefined,
    @Param('reservationId') reservationId: string,
    @Body() body: unknown,
  ): Promise<SendMessageResponse> {
    const userId = await this.resolveUserId(auth);
    const dto = SendMessageRequestSchema.parse(body);
    return this.messagingService.sendMessage(userId, reservationId, dto);
  }

  @Get()
  async list(
    @Headers('authorization') auth: string | undefined,
    @Param('reservationId') reservationId: string,
  ): Promise<ListMessagesResponse> {
    const userId = await this.resolveUserId(auth);
    return this.messagingService.listMessages(userId, reservationId);
  }

  @Post('read')
  @HttpCode(204)
  async markRead(
    @Headers('authorization') auth: string | undefined,
    @Param('reservationId') reservationId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const userId = await this.resolveUserId(auth);
    const dto = MarkReadBodySchema.parse(body);
    await this.messagingService.markRead(userId, reservationId, dto);
  }
}
