import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './infrastructure/modules/app.module';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';

const DEFAULT_CORS_ORIGINS = [
  'https://rocket-lease.vercel.app',
  'https://rocketlease.qzz.io',
  'http://localhost:4173',
  'https://dreamy-anyplace-zebra.ngrok-free.dev',
];

function resolveCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) {
  if (!origin) {
    callback(null, true);
    return;
  }
  const configuredOrigins = process.env.CORS_ORIGIN?.split(',') ?? [];
  const allowedOrigins =
    configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_CORS_ORIGINS;
  if (
    allowedOrigins.includes(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin)
  ) {
    callback(null, true);
    return;
  }
  callback(null, false);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: resolveCorsOrigin,
    credentials: true,
  });
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.listen(process.env.PORT ?? 8080);
}
void bootstrap();
