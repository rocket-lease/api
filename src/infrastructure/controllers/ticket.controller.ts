import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type GetMyTicketsResponse,
  type TicketResponse,
  CreateTicketRequestSchema,
} from '@rocket-lease/contracts';
import { TicketService } from '@/application/ticket.service';
import { AuthService } from '@/application/auth.service';

@Controller('tickets')
export class TicketsController {
  constructor(
    @Inject(TicketService)
    private readonly ticketService: TicketService,
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  private async resolveUserId(authorization?: string): Promise<string> {
    if (!authorization) throw new UnauthorizedException('Missing authorization header');
    try {
      return await this.authService.getUserIdFromToken(authorization);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  @Post()
  @HttpCode(201)
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): Promise<TicketResponse> {
    const userId = await this.resolveUserId(authorization);
    const dto = CreateTicketRequestSchema.parse(body);
    return this.ticketService.create(userId, dto);
  }

  @Get('mine')
  async getMyTickets(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<GetMyTicketsResponse> {
    const userId = await this.resolveUserId(authorization);
    return this.ticketService.getMyTickets(userId);
  }
}
