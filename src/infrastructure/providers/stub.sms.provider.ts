import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from '@/domain/providers/sms.provider';

@Injectable()
export class StubSmsProvider implements SmsProvider {
  private readonly logger = new Logger(StubSmsProvider.name);
  public readonly sent: Array<{ phone: string; code: string }> = [];

  async sendOtp(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
    this.logger.log(`[STUB SMS] to ${phone}: code=${code}`);
  }
}
