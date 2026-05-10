import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VehicleModule } from './infraestructure/modules/vehicle.module';

@Module({
  imports: [VehicleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
