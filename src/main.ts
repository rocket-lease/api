import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './infrastructure/modules/app.module';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? [
      'https://rocket-lease.vercel.app',
      'https://rocketlease.qzz.io',
      'http://localhost:5173',
      'http://localhost:4173',
      'https://dreamy-anyplace-zebra.ngrok-free.dev',
    ],
    credentials: true,
  });
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.listen(process.env.PORT ?? 8080);
}
void bootstrap();
