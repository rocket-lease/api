import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VehicleModule } from './vehicle.module';
import { AuthModule } from './auth.module';
import { FavoriteModule } from './favorite.module';
import { ProfileModule } from './profile.module';
import { VerificationModule } from './verification.module';
import { ReservationRuleSetModule } from './reservation-rule-set.module';
import { VehicleDocumentModule } from './vehicle-document.module';
import { ReservationModule } from './reservation.module';
import { UploadsModule } from './uploads.module';
import { GeoModule } from './geo.module';
import { MessagingModule } from './messaging.module';
import { BankAccountModule } from './bank-account.module';
import { PromotionModule } from './promotion.module';
import { IdentityModule } from './identity.module';
import { WalletModule } from './wallet.module';
import { PushSubscriptionModule } from './push-subscription.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    VehicleModule,
    AuthModule,
    FavoriteModule,
    ProfileModule,
    IdentityModule,
    VerificationModule,
    ReservationRuleSetModule,
    ReservationModule,
    UploadsModule,
    GeoModule,
    MessagingModule,
    BankAccountModule,
    PromotionModule,
    VehicleDocumentModule,
    WalletModule,
    PushSubscriptionModule,
  ],
})
export class AppModule {}
