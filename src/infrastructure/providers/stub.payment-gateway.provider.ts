import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentGatewayResult,
  PaymentGatewayProvider,
} from '@/domain/providers/payment-gateway.provider';

@Injectable()
export class StubPaymentGatewayProvider implements PaymentGatewayProvider {
  private readonly logger = new Logger(StubPaymentGatewayProvider.name);

  async processPayment(
    amountCents: number,
    currency: string,
    method: string,
  ): Promise<PaymentGatewayResult> {
    this.logger.log(
      `[STUB] Processing payment: ${amountCents} ${currency} via ${method}`,
    );
    return {
      success: true,
      transactionId: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  async generateTransferCode(): Promise<string> {
    const code = `CBU${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    this.logger.log(`[STUB] Generated transfer code: ${code}`);
    return code;
  }
}
