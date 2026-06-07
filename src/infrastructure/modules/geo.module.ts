import { Module } from '@nestjs/common';
import { GeoController } from '@/infrastructure/controllers/geo.controller';
import { GeoService } from '@/application/geo.service';
import { GEO_REPOSITORY } from '@/domain/repositories/geo.repository';
import { VEHICLE_REPOSITORY } from '@/domain/repositories/vehicle.repository';
import { PostgresGeoRepository } from '../repository/postgres.geo.repository';
import { PostgresVehicleRepository } from '../repository/postgres.vehicle.repository';
import { PrismaService } from '../database/prisma.service';
import { AuthModule } from './auth.module';
import { IdentityModule } from './identity.module';
import { SearchLogModule } from './search-log.module';

@Module({
  imports: [AuthModule, IdentityModule, SearchLogModule],
  controllers: [GeoController],
  providers: [
    GeoService,
    PrismaService,
    {
      provide: GEO_REPOSITORY,
      useClass: PostgresGeoRepository,
    },
    {
      provide: VEHICLE_REPOSITORY,
      useClass: PostgresVehicleRepository,
    },
  ],
  exports: [GeoService],
})
export class GeoModule {}
