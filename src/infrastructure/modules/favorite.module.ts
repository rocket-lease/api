import { Module } from '@nestjs/common';
import { FavoriteController } from '@/infrastructure/controllers/favorite.controller';
import { FAVORITE_REPOSITORY } from '@/domain/repositories/favorite.repository';
import { FavoriteService } from '@/application/favorite.service';
import { PostgresFavoriteRepository } from '@/infrastructure/repository/postgres.favorite.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FavoriteController],
  providers: [
    FavoriteService,
    PrismaService,
    {
      provide: FAVORITE_REPOSITORY,
      useClass: PostgresFavoriteRepository,
    },
  ],
})
export class FavoriteModule {}
