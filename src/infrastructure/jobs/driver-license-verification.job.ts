import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DriverLicenseService } from '@/application/driver-license.service';

@Injectable()
export class DriverLicenseVerificationJob {
  private readonly logger = new Logger(DriverLicenseVerificationJob.name);
  private running = false;

  constructor(@Inject(DriverLicenseService) private readonly driverLicenseService: DriverLicenseService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPending(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const processed = await this.driverLicenseService.processDueVerifications();
      if (processed > 0) {
        this.logger.log(`Verified ${processed} driver license verification(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to process driver license verifications', error as Error);
    } finally {
      this.running = false;
    }
  }
}