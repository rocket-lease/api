export class VerificationOtp {
  static readonly MAX_ATTEMPTS = 3;
  static readonly TTL_MINUTES = 5;

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly channel: 'email' | 'phone',
    public readonly codeHash: string,
    public attempts: number,
    public readonly expiresAt: Date,
    public usedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  isExpired(now: Date = new Date()): boolean {
    return now >= this.expiresAt;
  }

  isUsed(): boolean {
    return this.usedAt !== null;
  }

  attemptsLeft(): number {
    return Math.max(0, VerificationOtp.MAX_ATTEMPTS - this.attempts);
  }

  isExhausted(): boolean {
    return this.attempts >= VerificationOtp.MAX_ATTEMPTS;
  }
}
