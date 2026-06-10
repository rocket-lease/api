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
  RequestDisputeInfoRequestSchema,
  IssueDisputeVerdictRequestSchema,
  AppealDisputeRequestSchema,
  type DisputeResolutionResponse,
} from '@rocket-lease/contracts';
import { DisputeService } from '@/application/dispute.service';
import { AuthService } from '@/application/auth.service';

@Controller()
export class DisputeController {
  constructor(
    @Inject(DisputeService)
    private readonly disputeService: DisputeService,
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

  @Get('admin/tickets/:ticketId/dispute')
  async getDispute(
    @Headers('authorization') authorization: string | undefined,
    @Param('ticketId') ticketId: string,
  ): Promise<DisputeResolutionResponse | null> {
    const adminId = await this.resolveUserId(authorization);
    return this.disputeService.findByTicketId(adminId, ticketId);
  }

  @Post('admin/tickets/:ticketId/dispute/escalate')
  @HttpCode(201)
  async escalate(
    @Headers('authorization') authorization: string | undefined,
    @Param('ticketId') ticketId: string,
  ): Promise<DisputeResolutionResponse> {
    const adminId = await this.resolveUserId(authorization);
    return this.disputeService.escalate(adminId, ticketId);
  }

  @Post('admin/tickets/:ticketId/dispute/request-info')
  async requestInfo(
    @Headers('authorization') authorization: string | undefined,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ): Promise<DisputeResolutionResponse> {
    const adminId = await this.resolveUserId(authorization);
    const dto = RequestDisputeInfoRequestSchema.parse(body);
    return this.disputeService.requestInfo(adminId, ticketId, dto);
  }

  @Post('admin/tickets/:ticketId/dispute/verdict')
  async issueVerdict(
    @Headers('authorization') authorization: string | undefined,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ): Promise<DisputeResolutionResponse> {
    const adminId = await this.resolveUserId(authorization);
    const dto = IssueDisputeVerdictRequestSchema.parse(body);
    return this.disputeService.issueVerdict(adminId, ticketId, dto);
  }

  @Post('tickets/:ticketId/dispute/appeal')
  async appeal(
    @Headers('authorization') authorization: string | undefined,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ): Promise<DisputeResolutionResponse> {
    const userId = await this.resolveUserId(authorization);
    const dto = AppealDisputeRequestSchema.parse(body);
    return this.disputeService.appeal(userId, ticketId, dto);
  }
}
