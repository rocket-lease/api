import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentGatewayResult,
  PaymentGatewayProvider,
  TransferCodeResult,
} from '@/domain/providers/payment-gateway.provider';

@Injectable()
export class StubPaymentGatewayProvider implements PaymentGatewayProvider {
  private readonly logger = new Logger(StubPaymentGatewayProvider.name);
  private aliasCounter = 0;

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

  async generateTransferCode(): Promise<TransferCodeResult> {
    this.aliasCounter++;
    const code = `CBU${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const alias = `rocket.lease.${this.aliasCounter}`;
    this.logger.log(`[STUB] Generated transfer code: ${code}, alias: ${alias}`);
    return { code, alias };
  }
}
