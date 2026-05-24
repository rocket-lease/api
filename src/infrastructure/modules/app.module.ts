import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VehicleModule } from './vehicle.module';
import { AuthModule } from './auth.module';
import { FavoriteModule } from './favorite.module';
import { ProfileModule } from './profile.module';
import { VerificationModule } from './verification.module';
import { ReservationRuleSetModule } from './reservation-rule-set.module';
import { ReservationModule } from './reservation.module';
import { UploadsModule } from './uploads.module';
import { GeoModule } from './geo.module';
import { MessagingModule } from './messaging.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    VehicleModule,
    AuthModule,
    FavoriteModule,
    ProfileModule,
    VerificationModule,
    ReservationRuleSetModule,
    ReservationModule,
    UploadsModule,
    GeoModule,
    MessagingModule,
  ],
})
export class AppModule {}
