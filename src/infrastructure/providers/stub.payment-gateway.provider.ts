import { Injectable, Inject } from '@nestjs/common';
import {
  PaymentGatewayResult,
  PaymentGatewayProvider,
  TransferCodeResult,
} from '@/domain/providers/payment-gateway.provider';
import { LOGGER, type Logger } from '@/application/logger.interface';

@Injectable()
export class StubPaymentGatewayProvider implements PaymentGatewayProvider {
  @Inject(LOGGER) private readonly logger: Logger;
  private aliasCounter = 0;

  async processPayment(
    amountCents: number,
    currency: string,
    method: string,
  ): Promise<PaymentGatewayResult> {
    this.logger.info(
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
    this.logger.info(`[STUB] Generated transfer code: ${code}, alias: ${alias}`);
    return { code, alias };
  }
}
