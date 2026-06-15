import { Module, forwardRef } from '@nestjs/common';
import { LoyaltyController } from '@/infrastructure/controllers/loyalty.controller';
import { LoyaltyService } from '@/application/loyalty.service';
import { LOYALTY_REPOSITORY } from '@/domain/repositories/loyalty.repository';
import { PrismaLoyaltyRepository } from '@/infrastructure/repository/prisma-loyalty.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { PostgresUserRepository } from '@/infrastructure/repository/postgres.user.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import { AuthModule } from './auth.module';
import { PushSubscriptionModule } from './push-subscription.module';


@Module({
  imports: [AuthModule, forwardRef(() => PushSubscriptionModule)],
  controllers: [LoyaltyController],
  providers: [
    LoyaltyService,
    PrismaService,
    {
      provide: LOYALTY_REPOSITORY,
      useClass: PrismaLoyaltyRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: PostgresUserRepository,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [LoyaltyService, LOYALTY_REPOSITORY],
})
export class LoyaltyModule {}
