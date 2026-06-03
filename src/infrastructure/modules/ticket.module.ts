import { Module } from '@nestjs/common';
import { TicketsController } from '@/infrastructure/controllers/ticket.controller';
import { TicketService } from '@/application/ticket.service';
import { PostgresTicketRepository } from '@/infrastructure/repository/postgres.ticket.repository';
import { TICKET_REPOSITORY } from '@/domain/repositories/ticket.repository';
import { AuthModule } from './auth.module';
import { ReservationModule } from './reservation.module';
import { PushSubscriptionModule } from './push-subscription.module';

@Module({
  imports: [AuthModule, ReservationModule, PushSubscriptionModule],
  controllers: [TicketsController],
  providers: [
    TicketService,
    { provide: TICKET_REPOSITORY, useClass: PostgresTicketRepository },
  ],
})
export class TicketModule {}
