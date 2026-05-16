import { Module } from '@nestjs/common';
import { ReservationController } from '@/infrastructure/controllers/reservation.controller';
import { ReservationService } from '@/application/reservation.service';
import { RESERVATION_REPOSITORY } from '@/domain/repositories/reservation.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { PostgresReservationRepository } from '@/infrastructure/repository/postgres.reservation.repository';
import { PostgresVehicleRepository } from '@/infrastructure/repository/postgres.vehicle.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
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
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [ReservationService, CLOCK, RESERVATION_REPOSITORY],
})
export class ReservationModule {}
