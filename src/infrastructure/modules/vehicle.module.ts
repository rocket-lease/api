import { Module } from '@nestjs/common';
import { VehicleController } from '@/infrastructure/controllers/vehicle.controller';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { PROMOTION_REPOSITORY } from '@/domain/repositories/promotion.repository';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import { VehicleService } from '@/application/vehicle.service';
import { PostgresVehicleRepository } from '../repository/postgres.vehicle.repository';
import { PrismaPromotionRepository } from '../repository/prisma.promotion.repository';
import { PostgresVehicleDocumentRepository } from '../repository/postgres.vehicle-document.repository';
import { VEHICLE_DOCUMENT_REPOSITORY } from '@/domain/repositories/vehicle-document.repository';
import { AuthModule } from './auth.module';
import { ReservationRuleSetModule } from './reservation-rule-set.module';
import { ReservationModule } from './reservation.module';
import { BankAccountModule } from './bank-account.module';
import { IdentityModule } from './identity.module';
import { SearchLogModule } from './search-log.module';

@Module({
  imports: [
    AuthModule,
    ReservationModule,
    ReservationRuleSetModule,
    BankAccountModule,
    IdentityModule,
    SearchLogModule,
  ],
  controllers: [VehicleController],
  providers: [
    VehicleService,
    {
      provide: VEHICLE_REPOSITORY,
      useClass: PostgresVehicleRepository,
    },
    {
      provide: PROMOTION_REPOSITORY,
      useClass: PrismaPromotionRepository,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
    {
      provide: VEHICLE_DOCUMENT_REPOSITORY,
      useClass: PostgresVehicleDocumentRepository,
    },
  ],
  exports: [VehicleService, VEHICLE_REPOSITORY, VEHICLE_DOCUMENT_REPOSITORY],
})
export class VehicleModule {}
