import { AuthService } from '@/application/auth.service';
import { VehicleService } from '@/application/vehicle.service';
import {
    Body,
    Controller,
    Post,
    Get,
    Req,
    Patch,
    Param,
    Delete,
} from '@nestjs/common';
import * as Contracts from '@rocket-lease/contracts';
import * as Express from 'express';

@Controller('vehicle')
export class VehicleController {
    constructor(
        private readonly vehicleService: VehicleService,
        private readonly authService: AuthService,
    ) {}

    @Get('mine')
    async getMyVehicles(
        @Req() req: Express.Request,
    ): Promise<Array<Contracts.GetVehicleResponse>> {
        const authHeader = req.headers.authorization;
        if (!authHeader) throw new Error('Token not found');
        const ownerId = await this.authService.getUserIdFromToken(authHeader);
        return await this.vehicleService.getMyVehicles(ownerId);
    }

    @Get()
    async getVehicles(): Promise<Array<Contracts.GetVehicleResponse>> {
        return await this.vehicleService.getAll();
    }

    @Get(':id')
    async getVehicleById(
        @Param('id') id: string,
    ): Promise<Contracts.GetVehicleResponse> {
        return await this.vehicleService.getById(id);
    }

    @Delete(':id')
    async deleteVehicle(@Param('id') id: string): Promise<void> {
        await this.vehicleService.deleteVehicle(id);
    }

    @Patch(':id')
    async updateVehicle(
        @Param('id') id: string,
        @Body() dto: Contracts.UpdateVehicleRequest,
    ): Promise<void> {
        return await this.vehicleService.updateVehicle(id, dto);
    }

    @Post()
    async publishVehicle(
        @Body() dto: Contracts.CreateVehicleRequest,
        @Req() req: Express.Request,
    ): Promise<Contracts.CreateVehicleResponse> {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw Error('Token not found');
        }
        const ownerId = await this.authService.getUserIdFromToken(authHeader);
        return await this.vehicleService.createVehicle(ownerId, dto);
    }
}
