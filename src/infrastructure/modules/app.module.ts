import { Module } from '@nestjs/common';
import { VehicleModule } from './vehicle.module';
import { AuthModule } from './auth.module';
import { FavoriteModule } from './favorite.module';
import { ProfileModule } from './profile.module';
import { VerificationModule } from './verification.module';
import { ReservationRuleSetModule } from './reservation-rule-set.module';

@Module({
  imports: [
    VehicleModule,
    AuthModule,
    FavoriteModule,
    ProfileModule,
    VerificationModule,
    ReservationRuleSetModule,
  ],
})
export class AppModule {}
