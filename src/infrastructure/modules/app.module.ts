import { Module } from '@nestjs/common';
import { VehicleModule } from './vehicle.module';
import { AuthModule } from './auth.module';
import { ProfileModule } from './profile.module';

@Module({
  imports: [VehicleModule, AuthModule, ProfileModule],
})
export class AppModule {}
