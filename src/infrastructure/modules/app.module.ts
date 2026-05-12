import { Module } from '@nestjs/common';
import { VehicleModule } from './vehicle.module';
import { AuthModule } from './auth.module';
import { FavoriteModule } from './favorite.module';

@Module({
  imports: [VehicleModule, AuthModule, FavoriteModule],
})
export class AppModule {}
