export interface Voucher {
  qrCode: string;
}

export interface VoucherProvider {
  generateVoucher(reservationId: string): Promise<Voucher>;
}

export const VOUCHER_PROVIDER = Symbol('VoucherProvider');
