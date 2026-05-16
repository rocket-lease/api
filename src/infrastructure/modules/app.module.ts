import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VehicleModule } from './vehicle.module';
import { AuthModule } from './auth.module';
import { FavoriteModule } from './favorite.module';
import { ProfileModule } from './profile.module';
import { VerificationModule } from './verification.module';
import { ReservationModule } from './reservation.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    VehicleModule,
    AuthModule,
    FavoriteModule,
    ProfileModule,
    VerificationModule,
    ReservationModule,
  ],
})
export class AppModule {}
