import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type GetAdminTicketsResponse,
  type TicketResponse,
  UpdateTicketStatusRequestSchema,
} from '@rocket-lease/contracts';
import { TicketService } from '@/application/ticket.service';
import { AuthService } from '@/application/auth.service';

@Controller('admin/tickets')
export class AdminTicketController {
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

  @Get()
  async getQueue(
    @Headers('authorization') authorization: string | undefined,
  ): Promise<GetAdminTicketsResponse> {
    const adminId = await this.resolveUserId(authorization);
    return this.ticketService.getForAdmin(adminId);
  }

  @Get(':id')
  async getDetail(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): Promise<TicketResponse> {
    const adminId = await this.resolveUserId(authorization);
    return this.ticketService.getDetail(adminId, id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<TicketResponse> {
    const adminId = await this.resolveUserId(authorization);
    const dto = UpdateTicketStatusRequestSchema.parse(body);
    return this.ticketService.updateStatus(adminId, id, dto);
  }
}
