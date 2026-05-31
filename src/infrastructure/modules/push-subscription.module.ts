import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { PushSubscriptionService } from '@/application/push-subscription.service';
import { PushSubscriptionController } from '@/infrastructure/controllers/push-subscription.controller';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PUSH_SUBSCRIPTION_REPOSITORY } from '@/domain/repositories/push-subscription.repository';
import { PostgresPushSubscriptionRepository } from '@/infrastructure/repository/postgres.push-subscription.repository';
import { WebPushNotificationProvider } from '@/infrastructure/providers/web-push.notification.provider';
import { NOTIFICATION_PROVIDER } from '@/domain/providers/notification.provider';

@Module({
  imports: [AuthModule],
  controllers: [PushSubscriptionController],
  providers: [
    PushSubscriptionService,
    PrismaService,
    { provide: PUSH_SUBSCRIPTION_REPOSITORY, useClass: PostgresPushSubscriptionRepository },
    { provide: NOTIFICATION_PROVIDER, useClass: WebPushNotificationProvider },
  ],
  exports: [PushSubscriptionService, PUSH_SUBSCRIPTION_REPOSITORY, NOTIFICATION_PROVIDER],
})
export class PushSubscriptionModule {}
