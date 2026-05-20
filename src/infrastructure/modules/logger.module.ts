import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { LOGGER } from '@/application/logger.interface';
import { PinoLoggerAdapter } from '@/infrastructure/providers/pino.logger.provider';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', singleLine: true, ignore: 'pid,hostname' },
        },
        customLogLevel: (_req, res, _err) => {
          if (res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
        redact: { paths: ['req.headers.authorization'], censor: '***' },
        genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
        customAttributeKeys: { reqId: 'requestId' },
        customProps: (req) => ({
          requestId: req.id,
        }),
      },
    }),
  ],
  providers: [{ provide: LOGGER, useClass: PinoLoggerAdapter }],
  exports: [LOGGER],
})
export class LoggerModule {}
