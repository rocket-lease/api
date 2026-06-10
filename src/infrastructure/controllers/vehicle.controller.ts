import { AuthService } from '@/application/auth.service';
import { VehicleService } from '@/application/vehicle.service';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Req,
  Patch,
  Param,
  Query,
  Delete,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import * as Contracts from '@rocket-lease/contracts';
import type { Request } from 'express';
import { z } from 'zod';

@Controller('vehicle')
export class VehicleController {
  constructor(
    @Inject(VehicleService) private readonly vehicleService: VehicleService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  private async resolveUserId(req: Request): Promise<string> {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('Token not found');
    try {
      return await this.authService.getUserIdFromToken(authHeader);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  @Get('mine')
  async getMyVehicles(
    @Req() req: Request,
  ): Promise<Array<Contracts.GetVehicleResponse>> {
    const ownerId = await this.resolveUserId(req);
    return await this.vehicleService.getMyVehicles(ownerId);
  }

  @Get()
  async getVehicles(
    @Query('characteristics') characteristics?: string | string[],
    @Query('ownerId') ownerId?: string,
    @Query('city') city?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('promoted') promoted?: string,
  ): Promise<Array<Contracts.GetVehicleResponse>> {
    if (ownerId !== undefined) {
      const parsed = z.string().uuid().safeParse(ownerId);
      if (!parsed.success) {
        throw new BadRequestException('invalid ownerId');
      }
      return await this.vehicleService.getPublishedByOwnerId(parsed.data);
    }

    const parsedList: Contracts.Characteristic[] = [];

    if (characteristics) {
      const raw = Array.isArray(characteristics)
        ? characteristics
        : characteristics.split(',');
      for (const item of raw) {
        const trimmed = item.trim();
        if (!trimmed) continue;
        const parsed = Contracts.CharacteristicSchema.safeParse(trimmed);
        if (!parsed.success) {
          throw new BadRequestException(`invalid characteristic: ${trimmed}`);
        }
        parsedList.push(parsed.data);
      }
    }

    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
    if (from && !ISO_DATE.test(from)) throw new BadRequestException('from must be YYYY-MM-DD')
    if (to   && !ISO_DATE.test(to))   throw new BadRequestException('to must be YYYY-MM-DD')
    if (from && to && from > to)       throw new BadRequestException('from must be <= to')

    const filter = { city: city?.trim() || undefined, from, to };
    const unique = Array.from(new Set(parsedList));

    if (promoted === 'true') {
      return await this.vehicleService.getAllPromoted(filter);
    }

    if (unique.length > 0) {
      return await this.vehicleService.getByCharacteristics(unique, filter);
    }

    return await this.vehicleService.getAll(filter);
  }

  @Get('active-reservations-count')
  async activeReservationsCount(
    @Req() req: Request,
    @Query('vehicleIds') vehicleIdsParam?: string,
  ): Promise<Contracts.ActiveReservationsCountResponse> {
    const ownerId = await this.resolveUserId(req);
    const vehicleIds = (vehicleIdsParam ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    return this.vehicleService.getActiveReservationsCount(ownerId, vehicleIds);
  }

  @Get(':id')
  async getVehicleById(
    @Param('id') id: string,
  ): Promise<Contracts.GetVehicleResponse> {
    return await this.vehicleService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async publishVehicle(
    @Body() dto: Contracts.CreateVehicleRequest,
    @Req() req: Request,
  ): Promise<Contracts.CreateVehicleResponse> {
    const ownerId = await this.resolveUserId(req);
    console.log('VEHICLE_BODY:', JSON.stringify(dto));
    try {
      const parsed = Contracts.CreateVehicleRequestSchema.parse(dto);
      return await this.vehicleService.createVehicle(ownerId, parsed);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.log('ZOD_ISSUES:', JSON.stringify(err.issues));
      }
      throw err;
    }
  }

  @Patch('bulk-prices')
  async bulkUpdatePrices(
    @Req() req: Request,
    @Body() body: Contracts.BulkPriceUpdateRequest,
  ): Promise<Contracts.BulkPriceUpdateResponse> {
    const ownerId = await this.resolveUserId(req);
    return this.vehicleService.bulkUpdatePrices(ownerId, body);
  }

  @Patch(':id')
  async updateVehicle(
    @Param('id') id: string,
    @Body() dto: Contracts.UpdateVehicleRequest,
    @Req() req: Request,
  ): Promise<void> {
    const ownerId = await this.resolveUserId(req);
    return await this.vehicleService.updateVehicle(id, ownerId, dto);
  }

  @Delete(':id')
  async deleteVehicle(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const ownerId = await this.resolveUserId(req);
    await this.vehicleService.deleteVehicle(id, ownerId);
  }
}
