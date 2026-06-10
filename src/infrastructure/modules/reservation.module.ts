import { Module } from '@nestjs/common';
import { ReservationController } from '@/infrastructure/controllers/reservation.controller';
import { ReservationService } from '@/application/reservation.service';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { RESERVATION_RULE_SET_REPOSITORY } from '@/domain/repositories/reservation-rule-set.repository';
import { PostgresReservationRepository } from '@/infrastructure/repository/postgres.reservation.repository';
import { PostgresVehicleRepository } from '@/infrastructure/repository/postgres.vehicle.repository';
import { PostgresUserRepository } from '@/infrastructure/repository/postgres.user.repository';
import { PostgresReservationRuleSetRepository } from '@/infrastructure/repository/postgres.reservation-rule-set.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import {
  VOUCHER_PROVIDER,
} from '@/domain/providers/voucher.provider';
import {
  PAYMENT_GATEWAY_PROVIDER,
} from '@/domain/providers/payment-gateway.provider';
import { StubVoucherProvider } from '@/infrastructure/providers/stub.voucher.provider';
import { PushSubscriptionModule } from './push-subscription.module';
import { StubPaymentGatewayProvider } from '@/infrastructure/providers/stub.payment-gateway.provider';
import { ReservationExpiryJob } from '@/infrastructure/jobs/reservation-expiry.job';
import { AuthModule } from './auth.module';
import { EMAIL_PROVIDER } from '@/domain/providers/email.provider';
import { StubEmailProvider } from '@/infrastructure/providers/stub.email.provider';
import { ResendEmailProvider } from '@/infrastructure/providers/resend.email.provider';
import { SmtpEmailProvider } from '@/infrastructure/providers/smtp.email.provider';
import { IdentityModule } from './identity.module';
import { DriverLicenseModule } from './driver-license.module';
import { WalletModule } from './wallet.module';
import { ReviewModule } from './review.module';
import { PricingModule } from './pricing.module';
import { ReputationModule } from './reputation.module';

@Module({
  imports: [AuthModule, IdentityModule, DriverLicenseModule, WalletModule, ReviewModule, ReputationModule, PushSubscriptionModule, PricingModule],
  controllers: [ReservationController],
  providers: [
    ReservationService,
    ReservationExpiryJob,
    PrismaService,
    {
      provide: RESERVATION_REPOSITORY,
      useClass: PostgresReservationRepository,
    },
    {
      provide: VEHICLE_REPOSITORY,
      useClass: PostgresVehicleRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: PostgresUserRepository,
    },
    {
      provide: RESERVATION_RULE_SET_REPOSITORY,
      useClass: PostgresReservationRuleSetRepository,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
    {
      provide: VOUCHER_PROVIDER,
      useClass: StubVoucherProvider,
    },
    {
      provide: PAYMENT_GATEWAY_PROVIDER,
      useClass: StubPaymentGatewayProvider,
    },
    {
      provide: EMAIL_PROVIDER,
      useClass:
        process.env.EMAIL_PROVIDER === 'smtp'
          ? SmtpEmailProvider
          : process.env.EMAIL_PROVIDER === 'resend'
            ? ResendEmailProvider
            : StubEmailProvider,
    },
  ],
  exports: [
    ReservationService,
    CLOCK,
    RESERVATION_REPOSITORY,
    VOUCHER_PROVIDER,
    PAYMENT_GATEWAY_PROVIDER,
  ],
})
export class ReservationModule {}
