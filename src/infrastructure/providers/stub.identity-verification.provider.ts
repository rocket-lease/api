import { Injectable } from '@nestjs/common';
import { IdentityVerificationProvider } from '@/domain/providers/identity-verification.provider';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { Inject } from '@nestjs/common';

@Injectable()
export class StubIdentityVerificationProvider implements IdentityVerificationProvider {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  async submitVerification(): Promise<{
    providerName: string;
    providerRequestId: string;
    reviewAfterAt: Date;
  }> {
    const now = this.clock.now();
    return {
      providerName: 'stub-identity-provider',
      providerRequestId: `stub-identity-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      reviewAfterAt: new Date(now.getTime() + 30_000),
    };
  }
}