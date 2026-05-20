import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from './logger.module';
import { VehicleModule } from './vehicle.module';
import { AuthModule } from './auth.module';
import { FavoriteModule } from './favorite.module';
import { ProfileModule } from './profile.module';
import { VerificationModule } from './verification.module';
import { ReservationRuleSetModule } from './reservation-rule-set.module';
import { ReservationModule } from './reservation.module';
import { UploadsModule } from './uploads.module';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        LoggerModule,
        VehicleModule,
        AuthModule,
        FavoriteModule,
        ProfileModule,
        VerificationModule,
        ReservationRuleSetModule,
        ReservationModule,
        UploadsModule,
    ],
})
export class AppModule {}
