export interface EmailProvider {
  sendVoucherEmail(to: string, voucher: any): Promise<void>;
  sendCancellationEmail(to: string, subject: string, message: string): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EmailProvider');
