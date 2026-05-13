import { Module } from '@nestjs/common';
import { VehicleModule } from './vehicle.module';
import { AuthModule } from './auth.module';
import { FavoriteModule } from './favorite.module';
import { ProfileModule } from './profile.module';

@Module({
  imports: [VehicleModule, AuthModule, FavoriteModule, ProfileModule],
})
export class AppModule {}
