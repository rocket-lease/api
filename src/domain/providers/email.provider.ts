export interface EmailProvider {
  sendVoucherEmail(to: string, voucher: any): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EmailProvider');
