import { Module } from '@nestjs/common';
import { GeoController } from '@/infrastructure/controllers/geo.controller';
import { GeoService } from '@/application/geo.service';
import { GEO_REPOSITORY } from '@/domain/repositories/geo.repository';
import { PostgresGeoRepository } from '../repository/postgres.geo.repository';
import { AuthModule } from './auth.module';
import { IdentityModule } from './identity.module';

@Module({
  imports: [AuthModule, IdentityModule],
  controllers: [GeoController],
  providers: [
    GeoService,
    {
      provide: GEO_REPOSITORY,
      useClass: PostgresGeoRepository,
    },
  ],
  exports: [GeoService],
})
export class GeoModule {}
