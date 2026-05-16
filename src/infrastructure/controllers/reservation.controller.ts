import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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

  @Get('mine')
  async listMine(
    @Req() req: Request,
  ): Promise<Contracts.ListMyReservationsResponse> {
    const conductorId = await this.requireUserId(req);
    return await this.reservationService.listMine(conductorId);
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
