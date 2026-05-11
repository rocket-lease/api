import { VehicleService } from '@/application/vehicle.service';
import { Body, Controller, Post, Get } from '@nestjs/common';
import * as Contracts from '@rocket-lease/contracts';

@Controller('vehicle')
export class VehicleController {
    constructor(private readonly vehicleService: VehicleService) {
    }

    @Get()
    async getVehicles(): Promise<Array<Contracts.GetVehicleResponse>> {
        return await this.vehicleService.getAll();
    }

    @Post()
    async publishVehicle(@Body() dto: Contracts.CreateVehicleRequest): Promise<Contracts.CreateVehicleResponse> {
        return await this.vehicleService.createVehicle(dto);
    }
}
