import { Module } from '@nestjs/common';
import { AppController } from '@/infrastructure/controllers/app.controller';
import { AppService } from '../../application/app.service';
import { VehicleModule } from './vehicle.module';

@Module({
  imports: [VehicleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
