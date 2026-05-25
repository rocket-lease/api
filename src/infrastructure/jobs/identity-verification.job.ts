import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdentityService } from '@/application/identity.service';

@Injectable()
export class IdentityVerificationJob {
  private readonly logger = new Logger(IdentityVerificationJob.name);

  constructor(@Inject(IdentityService) private readonly identityService: IdentityService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPending(): Promise<void> {
    try {
      const processed = await this.identityService.processDueVerifications();
      if (processed > 0) {
        this.logger.log(`Verified ${processed} identity verification(s)`);
      }
    } catch (error) {
      this.logger.error('Failed to process identity verifications', error as Error);
    }
  }
}