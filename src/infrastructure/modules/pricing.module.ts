import { Module } from '@nestjs/common';
import { PricingController } from '@/infrastructure/controllers/pricing.controller';
import { PricingService } from '@/application/pricing.service';
import { VehicleModule } from './vehicle.module';

@Module({
  imports: [VehicleModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}