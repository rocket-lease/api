import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '@/application/auth.service';
import { ReservationService } from '@/application/reservation.service';
import * as Contracts from '@rocket-lease/contracts';

@Controller('reservations')
export class ReservationController {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  async create(
    @Body() dto: Contracts.CreateReservationRequest,
    @Req() req: Request,
  ): Promise<Contracts.CreateReservationResponse> {
    const conductorId = await this.requireUserId(req);
    const parsed = Contracts.CreateReservationRequestSchema.parse(dto);
    return await this.reservationService.createReservation(conductorId, parsed);
  }

  @Post(':id/payment')
  async confirmPayment(
    @Param('id') id: string,
    @Body() dto: Contracts.ConfirmReservationPaymentRequest,
    @Req() req: Request,
  ): Promise<Contracts.ConfirmReservationPaymentResponse> {
    const conductorId = await this.requireUserId(req);
    const parsed = Contracts.ConfirmReservationPaymentRequestSchema.parse(dto);
    return await this.reservationService.confirmPayment(
      conductorId,
      id,
      parsed,
    );
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Contracts.CancelReservationResponse> {
    const conductorId = await this.requireUserId(req);
    return await this.reservationService.cancelReservation(conductorId, id);
  }

  /**
   * `GET /reservations?role=conductor|owner&status[]&from&to&page&pageSize`
   *
   * Endpoint unificado para listar reservas desde la perspectiva del usuario
   * autenticado. Express coerce el query string a strings (o arrays cuando se
   * repite la key como `status[]=a&status[]=b`); este handler normaliza los
   * casos y delega validación final al schema de Zod.
   *
   * @throws UnauthorizedException si no hay header `Authorization` válido.
   * @throws BadRequestException si el query no matchea `ReservationsListRequestSchema`.
   */
  @Get()
  async list(
    @Query() query: Record<string, string | string[]>,
    @Req() req: Request,
  ): Promise<Contracts.ReservationsListResponse> {
    const userId = await this.requireUserId(req);
    const statusRaw = query.status;
    const status =
      statusRaw === undefined
        ? undefined
        : Array.isArray(statusRaw)
          ? statusRaw
          : [statusRaw];
    const parsed = Contracts.ReservationsListRequestSchema.parse({
      role: query.role,
      status,
      from: typeof query.from === 'string' ? query.from : undefined,
      to: typeof query.to === 'string' ? query.to : undefined,
      page: typeof query.page === 'string' ? Number(query.page) : undefined,
      pageSize:
        typeof query.pageSize === 'string' ? Number(query.pageSize) : undefined,
    });
    return await this.reservationService.list(userId, parsed);
  }

  @Get('vehicle/:vehicleId/busy-ranges')
  async getBusyRanges(
    @Param('vehicleId') vehicleId: string,
  ): Promise<Contracts.VehicleBusyRangesResponse> {
    return await this.reservationService.getBusyRangesForVehicle(vehicleId);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Contracts.GetReservationResponse> {
    const conductorId = await this.requireUserId(req);
    return await this.reservationService.getById(conductorId, id);
  }

  private async requireUserId(req: Request): Promise<string> {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('Token not found');
    return this.authService.getUserIdFromToken(authHeader);
  }
}
