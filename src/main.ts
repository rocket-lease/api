import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './infrastructure/modules/app.module';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
