import { Module } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ReputationController } from '../controllers/reputation.controller';
import { ReputationService } from '@/application/reputation.service';
import { REPUTATION_REPOSITORY } from '@/domain/repositories/reputation.repository';
import { PostgresReputationRepository } from '../repository/postgres.reputation.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { PostgresUserRepository } from '../repository/postgres.user.repository';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ReputationController],
  providers: [
    ReputationService,
    PrismaService,
    {
      provide: REPUTATION_REPOSITORY,
      useClass: PostgresReputationRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: PostgresUserRepository,
    },
  ],
  exports: [ReputationService],
})
export class ReputationModule {}
