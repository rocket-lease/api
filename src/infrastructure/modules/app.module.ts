import { Module } from '@nestjs/common';
import { VehicleModule } from './vehicle.module';
import { AuthModule } from './auth.module';

@Module({
  imports: [VehicleModule, AuthModule],
})
export class AppModule {}
