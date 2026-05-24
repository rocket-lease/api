import { Module } from '@nestjs/common';
import { MessagingController } from '@/infrastructure/controllers/messaging.controller';
import { MessagingService } from '@/application/messaging.service';
import { PostgresMessageRepository } from '@/infrastructure/repository/postgres.message.repository';
import { StubNotificationProvider } from '@/infrastructure/providers/stub.notification.provider';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { MESSAGE_REPOSITORY } from '@/domain/repositories/message.repository';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';
import { AuthModule } from './auth.module';
import { ReservationModule } from './reservation.module';

@Module({
  imports: [AuthModule, ReservationModule],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    PrismaService,
    { provide: MESSAGE_REPOSITORY, useClass: PostgresMessageRepository },
    { provide: NOTIFICATION_PROVIDER, useClass: StubNotificationProvider },
  ],
})
export class MessagingModule {}
