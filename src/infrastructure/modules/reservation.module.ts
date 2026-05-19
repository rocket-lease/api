import { Module } from '@nestjs/common';
import { ReservationController } from '@/infrastructure/controllers/reservation.controller';
import { ReservationService } from '@/application/reservation.service';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { PostgresReservationRepository } from '@/infrastructure/repository/postgres.reservation.repository';
import { PostgresVehicleRepository } from '@/infrastructure/repository/postgres.vehicle.repository';
import { PostgresUserRepository } from '@/infrastructure/repository/postgres.user.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import {
  VOUCHER_PROVIDER,
} from '@/domain/providers/voucher.provider';
import {
  NOTIFICATION_PROVIDER,
} from '@/domain/providers/notification.provider';
import {
  PAYMENT_GATEWAY_PROVIDER,
} from '@/domain/providers/payment-gateway.provider';
import { StubVoucherProvider } from '@/infrastructure/providers/stub.voucher.provider';
import { StubNotificationProvider } from '@/infrastructure/providers/stub.notification.provider';
import { StubPaymentGatewayProvider } from '@/infrastructure/providers/stub.payment-gateway.provider';
import { ReservationExpiryJob } from '@/infrastructure/jobs/reservation-expiry.job';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
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
      provide: CLOCK,
      useClass: SystemClock,
    },
    {
      provide: VOUCHER_PROVIDER,
      useClass: StubVoucherProvider,
    },
    {
      provide: NOTIFICATION_PROVIDER,
      useClass: StubNotificationProvider,
    },
    {
      provide: PAYMENT_GATEWAY_PROVIDER,
      useClass: StubPaymentGatewayProvider,
    },
  ],
  exports: [
    ReservationService,
    CLOCK,
    RESERVATION_REPOSITORY,
    VOUCHER_PROVIDER,
    NOTIFICATION_PROVIDER,
    PAYMENT_GATEWAY_PROVIDER,
  ],
})
export class ReservationModule {}
