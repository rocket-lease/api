import { Module } from '@nestjs/common';
import { DashboardController } from '@/infrastructure/controllers/dashboard.controller';
import { DashboardService } from '@/application/dashboard.service';
import { DASHBOARD_REPOSITORY } from '@/domain/repositories/dashboard.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { PostgresDashboardRepository } from '@/infrastructure/repository/postgres.dashboard.repository';
import { PostgresUserRepository } from '@/infrastructure/repository/postgres.user.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CLOCK, SystemClock } from '@/domain/providers/clock.provider';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    PrismaService,
    {
      provide: DASHBOARD_REPOSITORY,
      useClass: PostgresDashboardRepository,
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
  exports: [DashboardService],
})
export class DashboardModule {}
