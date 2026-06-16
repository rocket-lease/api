import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { PushSubscriptionService } from '@/application/push-subscription.service';
import { NotificationService } from '@/application/notification.service';
import { PushSubscriptionController } from '@/infrastructure/controllers/push-subscription.controller';
import { NotificationController } from '@/infrastructure/controllers/notification.controller';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '@/domain/repositories/push-subscription.repository';
import { PostgresPushSubscriptionRepository } from '@/infrastructure/repository/postgres.push-subscription.repository';
import { NOTIFICATION_REPOSITORY } from '@/domain/repositories/notification.repository';
import { PostgresNotificationRepository } from '@/infrastructure/repository/postgres.notification.repository';
import { WebPushNotificationProvider } from '@/infrastructure/providers/web-push.notification.provider';
import { PersistingNotificationProvider } from '@/infrastructure/providers/persisting.notification.provider';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';

@Module({
  imports: [AuthModule],
  controllers: [PushSubscriptionController, NotificationController],
  providers: [
    PushSubscriptionService,
    NotificationService,
    PrismaService,
    { provide: PUSH_SUBSCRIPTION_REPOSITORY, useClass: PostgresPushSubscriptionRepository },
    { provide: NOTIFICATION_REPOSITORY, useClass: PostgresNotificationRepository },
    WebPushNotificationProvider,
    { provide: NOTIFICATION_PROVIDER, useClass: PersistingNotificationProvider },
  ],
  exports: [PushSubscriptionService, PUSH_SUBSCRIPTION_REPOSITORY, NOTIFICATION_PROVIDER],
})
export class PushSubscriptionModule {}
