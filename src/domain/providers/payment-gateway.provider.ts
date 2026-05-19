export interface PaymentGatewayResult {
  success: boolean;
  transactionId: string;
}

export interface TransferCodeResult {
  code: string;
  alias: string;
}

export interface PaymentGatewayProvider {
  /**
   * Procesa un pago inmediato (tarjeta crédito/débito).
   * Siempre exitoso en stub.
   */
  processPayment(
    amountCents: number,
    currency: string,
    method: string,
  ): Promise<PaymentGatewayResult>;

  /**
   * Genera un código de transferencia bancaria (CBU/CVU simulado).
   */
  generateTransferCode(): Promise<TransferCodeResult>;
}

export const PAYMENT_GATEWAY_PROVIDER = Symbol('PaymentGatewayProvider');
