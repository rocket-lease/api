import { z } from 'zod';
import { InvalidEntityDataException } from '../../exceptions/domain.exception';

const promotionDaysSchema = z.object({
    durationDays: z.number().int().gte(0).lte(30),
    totalCents: z.number().int().nonnegative(),
});

export class PromotionDays {
    constructor(
        public readonly durationDays: number,
        public readonly totalCents: number,
    ) {
        this.validate();
    }

    private validate(): void {
        const result = promotionDaysSchema.safeParse({
            totalCents: this.totalCents,
            durationDays: this.durationDays,
        });
        if (!result.success) {
            throw new InvalidEntityDataException(result.error.issues[0].message);
        }
    }

    public getDurationDays(): number {
        return this.durationDays;
    }

    public getTotalCents(): number {
        return this.totalCents;
    }
}
