import { Injectable, Logger } from '@nestjs/common';
import {
  Voucher,
  VoucherProvider,
} from '@/domain/providers/voucher.provider';

@Injectable()
export class StubVoucherProvider implements VoucherProvider {
  private readonly logger = new Logger(StubVoucherProvider.name);

  async generateVoucher(reservationId: string): Promise<Voucher> {
    this.logger.log(`[STUB] Generating voucher for reservation ${reservationId}`);
    // Simula un QR code como hash del ID de reserva
    const qrCode = `QR-${reservationId}-${Date.now()}`;
    return { qrCode };
  }
}
