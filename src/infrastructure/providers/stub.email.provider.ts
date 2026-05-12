import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from '@/domain/providers/email.provider';

@Injectable()
export class StubEmailProvider implements EmailProvider {
  private readonly logger = new Logger(StubEmailProvider.name);
  public readonly sent: Array<{ email: string; code: string }> = [];

  async sendOtp(email: string, code: string): Promise<void> {
    this.sent.push({ email, code });
    this.logger.log(`[STUB EMAIL] to ${email}: code=${code}`);
  }
}
