import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
import { NestFactory } from '@nestjs/core';
import { AppModule } from './infrastructure/modules/app.module';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';

const CORS_REGEXES = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:\d+$/,
  /^https?:\/\/.*\.ngrok-free\.dev$/,
];

const DEFAULT_CORS_ORIGINS = [
  'https://rocket-lease.vercel.app',
  'https://rocketlease.qzz.io',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];

function resolveCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) {
  if (!origin) {
    callback(null, true);
    return;
  }
  if (DEFAULT_CORS_ORIGINS.includes(origin)) {
    callback(null, true);
    return;
  }
  for (const regex of CORS_REGEXES) {
    if (regex.test(origin)) {
      callback(null, true);
      return;
    }
  }
  const configuredOrigins = process.env.CORS_ORIGIN?.split(',') ?? [];
  if (configuredOrigins.includes(origin)) {
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
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'Idempotency-Key'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.getHttpAdapter().getInstance().set('etag', false);
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.listen(process.env.PORT ?? 8080);
}
void bootstrap();
