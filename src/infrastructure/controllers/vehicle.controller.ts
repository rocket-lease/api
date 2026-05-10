import { VehicleService } from '@/application/vehicle.service';
import { Body, Controller, Post, Get } from '@nestjs/common';

@Controller('vehicle')
export class VehicleController {
    constructor(private readonly vehicleService: VehicleService) {
    }

    @Get()
    async getVehicles(): Promise<Array<any>> {
        return await this.vehicleService.getAll();
    }
    @Post()
    // TODO: usar dto
    async publishVehicle(@Body() dto: any) {
        return await this.vehicleService.createVehicle(dto);
    }
}
