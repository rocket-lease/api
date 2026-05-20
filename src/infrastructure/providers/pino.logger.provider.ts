import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Logger } from '@/application/logger.interface';

@Injectable()
export class PinoLoggerAdapter implements Logger {
  constructor(private readonly pino: PinoLogger) {}

  info(message: string, ...args: unknown[]): void {
    this.pino.info({ args }, message);
  }

  warn(message: string, ...args: unknown[]): void {
    this.pino.warn({ args }, message);
  }

  error(message: string, ...args: unknown[]): void {
    this.pino.error({ args }, message);
  }

  debug(message: string, ...args: unknown[]): void {
    this.pino.debug({ args }, message);
  }
}
