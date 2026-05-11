import { Module } from '@nestjs/common';
import { AuthModule } from '@/infrastructure/modules/auth.module';

@Module({
  imports: [AuthModule],
})
export class AppModule {}
