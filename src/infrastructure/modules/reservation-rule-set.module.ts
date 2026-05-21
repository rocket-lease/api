import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { ReservationRuleSetController } from '@/infrastructure/controllers/reservation-rule-set.controller';
import { PrivateRuleSetVehicleController } from '@/infrastructure/controllers/private-rule-set-vehicle.controller';
import { ReservationRuleSetService } from '@/application/reservation-rule-set.service';
import { RESERVATION_RULE_SET_REPOSITORY } from '@/domain/repositories/reservation-rule-set.repository';
import { PostgresReservationRuleSetRepository } from '@/infrastructure/repository/postgres.reservation-rule-set.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { PostgresVehicleRepository } from '@/infrastructure/repository/postgres.vehicle.repository';

@Module({
  imports: [AuthModule],
  controllers: [ReservationRuleSetController, PrivateRuleSetVehicleController],
  providers: [
    ReservationRuleSetService,
    {
      provide: RESERVATION_RULE_SET_REPOSITORY,
      useClass: PostgresReservationRuleSetRepository,
    },
    // Necesario para validar ownership al crear un set privado o al pedir el
    // set privado de un vehículo. Se registra acá para no crear una
    // dependencia circular con `VehicleModule`, que ya importa este módulo.
    {
      provide: VEHICLE_REPOSITORY,
      useClass: PostgresVehicleRepository,
    },
  ],
  exports: [ReservationRuleSetService],
})
export class ReservationRuleSetModule {}
