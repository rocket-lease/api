import { IdentityVerificationJob } from '@/infrastructure/jobs/identity-verification.job';
import type { IdentityService } from '@/application/identity.service';

describe('IdentityVerificationJob — guard de solapamiento', () => {
  it('no arranca una segunda corrida mientras la anterior sigue en vuelo', async () => {
    let release!: (n: number) => void;
    const inFlight = new Promise<number>((resolve) => {
      release = resolve;
    });
    const processDueVerifications = jest.fn().mockReturnValue(inFlight);
    const service = { processDueVerifications } as unknown as IdentityService;
    const job = new IdentityVerificationJob(service);

    const first = job.processPending();
    await job.processPending();
    expect(processDueVerifications).toHaveBeenCalledTimes(1);

    release(0);
    await first;

    await job.processPending();
    expect(processDueVerifications).toHaveBeenCalledTimes(2);
  });
});
