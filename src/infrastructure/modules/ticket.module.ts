import { Module } from '@nestjs/common';
import { TicketsController } from '@/infrastructure/controllers/ticket.controller';
import { AdminTicketController } from '@/infrastructure/controllers/admin-ticket.controller';
import { TicketMessageController } from '@/infrastructure/controllers/ticket-message.controller';
import { TicketService } from '@/application/ticket.service';
import { TicketMessageService } from '@/application/ticket-message.service';
import { PostgresTicketRepository } from '@/infrastructure/repository/postgres.ticket.repository';
import { PostgresTicketMessageRepository } from '@/infrastructure/repository/postgres.ticket-message.repository';
import { TICKET_REPOSITORY } from '@/domain/repositories/ticket.repository';
import { TICKET_MESSAGE_REPOSITORY } from '@/domain/repositories/ticket-message.repository';
import { AuthModule } from './auth.module';
import { ReservationModule } from './reservation.module';
import { PushSubscriptionModule } from './push-subscription.module';
import { WalletModule } from './wallet.module';
import { ReputationModule } from './reputation.module';

@Module({
  imports: [AuthModule, ReservationModule, PushSubscriptionModule, WalletModule, ReputationModule],
  controllers: [TicketsController, AdminTicketController, TicketMessageController],
  providers: [
    TicketService,
    TicketMessageService,
    { provide: TICKET_REPOSITORY, useClass: PostgresTicketRepository },
    { provide: TICKET_MESSAGE_REPOSITORY, useClass: PostgresTicketMessageRepository },
  ],
})
export class TicketModule {}
