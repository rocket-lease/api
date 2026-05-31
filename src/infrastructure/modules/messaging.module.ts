import { Module } from '@nestjs/common';
import { MessagingController } from '@/infrastructure/controllers/messaging.controller';
import { MessagingService } from '@/application/messaging.service';
import { PostgresMessageRepository } from '@/infrastructure/repository/postgres.message.repository';
import { MESSAGE_REPOSITORY } from '@/domain/repositories/message.repository';
import { AuthModule } from './auth.module';
import { ReservationModule } from './reservation.module';
import { PushSubscriptionModule } from './push-subscription.module';

@Module({
  imports: [AuthModule, ReservationModule, PushSubscriptionModule],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    { provide: MESSAGE_REPOSITORY, useClass: PostgresMessageRepository },
  ],
})
export class MessagingModule {}
