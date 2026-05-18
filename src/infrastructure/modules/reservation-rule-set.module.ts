import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { ReservationRuleSetController } from '@/infrastructure/controllers/reservation-rule-set.controller';
import { ReservationRuleSetService } from '@/application/reservation-rule-set.service';
import { RESERVATION_RULE_SET_REPOSITORY } from '@/domain/repositories/reservation-rule-set.repository';
import { PostgresReservationRuleSetRepository } from '@/infrastructure/repository/postgres.reservation-rule-set.repository';

@Module({
  imports: [AuthModule],
  controllers: [ReservationRuleSetController],
  providers: [
    ReservationRuleSetService,
    {
      provide: RESERVATION_RULE_SET_REPOSITORY,
      useClass: PostgresReservationRuleSetRepository,
    },
  ],
  exports: [ReservationRuleSetService],
})
export class ReservationRuleSetModule {}