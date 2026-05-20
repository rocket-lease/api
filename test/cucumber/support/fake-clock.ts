import { Clock } from '@/domain/providers/clock.provider';

export class FakeClock implements Clock {
  private current: Date = new Date();

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(date: Date): void {
    this.current = date;
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
