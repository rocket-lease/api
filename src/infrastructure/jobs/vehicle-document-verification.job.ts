import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VehicleDocumentService } from '@/application/vehicle-document.service';

@Injectable()
export class VehicleDocumentVerificationJob {
  private readonly logger = new Logger(VehicleDocumentVerificationJob.name);
  private running = false;

  constructor(
    @Inject(VehicleDocumentService)
    private readonly vehicleDocumentService: VehicleDocumentService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPending(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const processed =
        await this.vehicleDocumentService.processPendingVerifications();
      if (processed.processed > 0) {
        this.logger.log(
          `Verified ${processed.processed} vehicle document verification(s)`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to process vehicle document verifications',
        error as Error,
      );
    } finally {
      this.running = false;
    }
  }
}
