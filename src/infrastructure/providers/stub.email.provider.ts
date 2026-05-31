import { Injectable } from '@nestjs/common';
import { EmailProvider } from '../../domain/providers/email.provider';
import { Voucher } from '@rocket-lease/contracts';

@Injectable()
export class StubEmailProvider implements EmailProvider {
  async sendVoucherEmail(to: string, voucher: Voucher): Promise<void> {
    console.log(`[Email Stub] Enviando voucher a ${to} para reserva ${voucher.reservationId}`);
  }

  async sendCancellationEmail(to: string, subject: string, message: string): Promise<void> {
    console.log(`[Email Stub] Enviando email de cancelación a ${to}: ${subject} - ${message}`);
  }
}
