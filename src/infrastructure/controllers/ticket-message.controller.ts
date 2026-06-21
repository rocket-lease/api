import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SendTicketMessageRequestSchema,
  type SendTicketMessageResponse,
  type ListTicketMessagesResponse,
} from '@rocket-lease/contracts';
import { TicketMessageService } from '@/application/ticket-message.service';
import { AuthService } from '@/application/auth.service';

@Controller('tickets/:ticketId/messages')
export class TicketMessageController {
  constructor(
    @Inject(TicketMessageService)
    private readonly ticketMessageService: TicketMessageService,
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  private async resolveUserId(authHeader: string | undefined): Promise<string> {
    if (!authHeader) throw new UnauthorizedException('Missing Authorization header');
    try {
      return await this.authService.getUserIdFromToken(authHeader);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token', { cause: error });
    }
  }

  @Post()
  @HttpCode(201)
  async send(
    @Headers('authorization') auth: string | undefined,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ): Promise<SendTicketMessageResponse> {
    const userId = await this.resolveUserId(auth);
    const dto = SendTicketMessageRequestSchema.parse(body);
    return this.ticketMessageService.sendMessage(userId, ticketId, dto);
  }

  @Get()
  async list(
    @Headers('authorization') auth: string | undefined,
    @Param('ticketId') ticketId: string,
    @Query('party') party?: string,
    @Query('after') after?: string,
  ): Promise<ListTicketMessagesResponse> {
    const userId = await this.resolveUserId(auth);
    let afterDate: Date | undefined;
    if (after !== undefined) {
      afterDate = new Date(after);
      if (isNaN(afterDate.getTime())) {
        throw new BadRequestException(`Query param 'after' must be a valid ISO 8601 date string`);
      }
    }
    return this.ticketMessageService.listMessages(userId, ticketId, party, afterDate);
  }
}
