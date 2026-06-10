import { Module } from '@nestjs/common';
import { TicketsController } from '@/infrastructure/controllers/ticket.controller';
import { AdminTicketController } from '@/infrastructure/controllers/admin-ticket.controller';
import { TicketMessageController } from '@/infrastructure/controllers/ticket-message.controller';
import { DisputeController } from '@/infrastructure/controllers/dispute.controller';
import { TicketService } from '@/application/ticket.service';
import { TicketMessageService } from '@/application/ticket-message.service';
import { DisputeService } from '@/application/dispute.service';
import { PostgresTicketRepository } from '@/infrastructure/repository/postgres.ticket.repository';
import { PostgresTicketMessageRepository } from '@/infrastructure/repository/postgres.ticket-message.repository';
import { PostgresDisputeResolutionRepository } from '@/infrastructure/repository/postgres.dispute-resolution.repository';
import { TICKET_REPOSITORY } from '@/domain/repositories/ticket.repository';
import { TICKET_MESSAGE_REPOSITORY } from '@/domain/repositories/ticket-message.repository';
import { DISPUTE_RESOLUTION_REPOSITORY } from '@/domain/repositories/dispute-resolution.repository';
import { AuthModule } from './auth.module';
import { ReservationModule } from './reservation.module';
import { PushSubscriptionModule } from './push-subscription.module';
import { WalletModule } from './wallet.module';

@Module({
  imports: [AuthModule, ReservationModule, PushSubscriptionModule, WalletModule],
  controllers: [TicketsController, AdminTicketController, TicketMessageController, DisputeController],
  providers: [
    TicketService,
    TicketMessageService,
    DisputeService,
    { provide: TICKET_REPOSITORY, useClass: PostgresTicketRepository },
    { provide: TICKET_MESSAGE_REPOSITORY, useClass: PostgresTicketMessageRepository },
    { provide: DISPUTE_RESOLUTION_REPOSITORY, useClass: PostgresDisputeResolutionRepository },
  ],
})
export class TicketModule {}
