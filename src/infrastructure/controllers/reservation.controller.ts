import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '@/application/auth.service';
import { ReservationService } from '@/application/reservation.service';
import { ReviewService } from '@/application/review.service';
import * as Contracts from '@rocket-lease/contracts';

@Controller('reservations')
export class ReservationController {
  constructor(
    @Inject(ReservationService) private readonly reservationService: ReservationService,
    @Inject(ReviewService) private readonly reviewService: ReviewService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Get(':id/payment-methods')
  async getPaymentMethods(
    @Param('id') _id: string,
  ): Promise<Contracts.PaymentMethodsResponse> {
    return await this.reservationService.getPaymentMethods();
  }

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
  @HttpCode(HttpStatus.OK)
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

  @Post(':id/transfer')
  async initiateTransfer(
    @Param('id') id: string,
    @Body() dto: Contracts.InitiateTransferRequest,
    @Req() req: Request,
  ): Promise<Contracts.InitiateTransferResponse> {
    const conductorId = await this.requireUserId(req);
    const parsed = Contracts.InitiateTransferRequestSchema.parse(dto ?? {});
    return await this.reservationService.initiateBankTransfer(
      conductorId,
      id,
      parsed,
    );
  }

  @Post(':id/transfer/confirm')
  async confirmTransfer(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Contracts.ConfirmTransferResponse> {
    const conductorId = await this.requireUserId(req);
    return await this.reservationService.confirmTransferPayment(
      conductorId,
      id,
    );
  }

  // US-30: pago del saldo de una reserva señada.
  @Post(':id/balance')
  @HttpCode(HttpStatus.OK)
  async payBalance(
    @Param('id') id: string,
    @Body() dto: Contracts.ConfirmReservationBalanceRequest,
    @Req() req: Request,
  ): Promise<Contracts.ConfirmReservationBalanceResponse> {
    const conductorId = await this.requireUserId(req);
    const parsed = Contracts.ConfirmReservationBalanceRequestSchema.parse(dto);
    return await this.reservationService.payBalance(conductorId, id, parsed);
  }

  @Post(':id/balance/transfer')
  async initiateBalanceTransfer(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Contracts.InitiateBalanceTransferResponse> {
    const conductorId = await this.requireUserId(req);
    return await this.reservationService.initiateBalanceTransfer(conductorId, id);
  }

  @Post(':id/balance/transfer/confirm')
  async confirmBalanceTransfer(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Contracts.ConfirmBalanceTransferResponse> {
    const conductorId = await this.requireUserId(req);
    return await this.reservationService.confirmBalanceTransfer(conductorId, id);
  }

  @Post(':id/extend')
  async extend(
    @Param('id') id: string,
    @Body() dto: Contracts.ExtendReservationRequest,
    @Req() req: Request,
  ): Promise<Contracts.ExtendReservationResponse> {
    const conductorId = await this.requireUserId(req);
    const parsed = Contracts.ExtendReservationRequestSchema.parse(dto);
    return await this.reservationService.extendReservation(
      conductorId,
      id,
      parsed,
    );
  }

  @Patch(':id/extend')
  async modifyExtension(
    @Param('id') id: string,
    @Body() dto: Contracts.ExtendReservationRequest,
    @Req() req: Request,
  ): Promise<Contracts.ExtendReservationResponse> {
    const conductorId = await this.requireUserId(req);
    const parsed = Contracts.ExtendReservationRequestSchema.parse(dto);
    return await this.reservationService.modifyExtension(
      conductorId,
      id,
      parsed,
    );
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Contracts.CancelReservationResponse> {
    const conductorId = await this.requireUserId(req);
    return await this.reservationService.cancelReservation(conductorId, id);
  }

  @Post(':id/cancel-by-owner')
  @HttpCode(HttpStatus.OK)
  async cancelByOwner(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Contracts.CancelReservationResponse> {
    const rentadorId = await this.requireUserId(req);
    return await this.reservationService.cancelReservationByRentador(rentadorId, id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Contracts.ApproveReservationResponse> {
    const rentadorId = await this.requireUserId(req);
    return await this.reservationService.approve(rentadorId, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @Body() dto: Contracts.RejectReservationRequest,
    @Req() req: Request,
  ): Promise<Contracts.RejectReservationResponse> {
    const rentadorId = await this.requireUserId(req);
    const parsed = Contracts.RejectReservationRequestSchema.parse(dto ?? {});
    return await this.reservationService.reject(
      rentadorId,
      id,
      parsed.reason ?? null,
    );
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

  @Post('pickup')
  @HttpCode(HttpStatus.OK)
  async confirmPickup(
    @Body() dto: Contracts.ConfirmPickupRequest,
    @Req() req: Request,
  ): Promise<Contracts.ConfirmPickupResponse> {
    const rentadorId = await this.requireUserId(req);
    const parsed = Contracts.ConfirmPickupRequestSchema.parse(dto);
    return await this.reservationService.confirmPickup(rentadorId, parsed.voucherToken);
  }

  @Post('return')
  @HttpCode(HttpStatus.OK)
  async confirmReturn(
    @Body() dto: Contracts.ConfirmReturnRequest,
    @Req() req: Request,
  ): Promise<Contracts.ConfirmReturnResponse> {
    const conductorId = await this.requireUserId(req);
    const parsed = Contracts.ConfirmReturnRequestSchema.parse(dto);
    return await this.reservationService.confirmReturn(conductorId, parsed.returnQrToken);
  }

  @Get('voucher/verify/:token')
  async verifyVoucher(
    @Param('token') token: string,
  ): Promise<Contracts.VerifyVoucherResponse> {
    return await this.reservationService.verifyVoucher(token);
  }

  @Get(':id/voucher')
  async getVoucher(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Contracts.Voucher> {
    const conductorId = await this.requireUserId(req);
    return await this.reservationService.getVoucher(id, conductorId);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.CREATED)
  async createReview(
    @Param('id') id: string,
    @Body() dto: Contracts.CreateReviewRequest,
    @Req() req: Request,
  ): Promise<Contracts.CreateReviewResponse> {
    const conductorId = await this.requireUserId(req);
    const parsed = Contracts.CreateReviewRequestSchema.parse(dto);
    return await this.reviewService.createReview(conductorId, id, parsed);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Contracts.GetReservationResponse> {
    const userId = await this.requireUserId(req);
    const reservation = await this.reservationService.getById(userId, id);
    const reviews = await this.reviewService.getReservationReviewsByUser(id, userId);
    return { ...reservation, review: reviews[0] ?? null };
  }

  private async requireUserId(req: Request): Promise<string> {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('Token not found');
    try {
      return await this.authService.getUserIdFromToken(authHeader);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
