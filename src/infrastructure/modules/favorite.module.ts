import { Module } from '@nestjs/common';
import { FavoriteController } from '@/infrastructure/controllers/favorite.controller';
import { FAVORITE_REPOSITORY } from '@/domain/repositories/favorite.repository';
import { FavoriteService } from '@/application/favorite.service';
import { InMemoryFavoriteRepository } from '@/infrastructure/repository/inMemoryFavorite.repository';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FavoriteController],
  providers: [
    FavoriteService,
    {
      provide: FAVORITE_REPOSITORY,
      useClass: InMemoryFavoriteRepository,
    },
  ],
})
export class FavoriteModule {}
