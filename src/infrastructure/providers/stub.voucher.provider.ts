import { Inject, Injectable } from '@nestjs/common';
import {
  Voucher,
  VoucherProvider,
} from '@/domain/providers/voucher.provider';
import { LOGGER, type Logger } from '@/application/logger.interface';

@Injectable()
export class StubVoucherProvider implements VoucherProvider {
  @Inject(LOGGER) private readonly logger: Logger;

  async generateVoucher(reservationId: string): Promise<Voucher> {
    this.logger.info(`[STUB] Generating voucher for reservation ${reservationId}`);
    // Simula un QR code como hash del ID de reserva
    const qrCode = `QR-${reservationId}-${Date.now()}`;
    return { qrCode };
  }
}
