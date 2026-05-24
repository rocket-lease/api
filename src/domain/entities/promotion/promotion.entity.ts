import { z } from 'zod';
import { InvalidEntityDataException } from '../../exceptions/domain.exception';
import { PromotionDays } from './promotion.days.entity';

const promotionSchema = z.object({
    vehicleId: z.string().uuid(),
    durationDays: z.number().int().gte(0).lte(30),
    totalCents: z.number().int().nonnegative(),
    startDate: z.date(),
    status: z.enum(['active', 'pending_approval']),
    paymentMethod: z.string().min(1),
    paidAt: z.date().nullable(),
    transactionId: z.string().nullable(),
    transferCode: z.string().nullable(),
    transferAlias: z.string().nullable(),
    transferExpiresAt: z.date().nullable(),
    createdAt: z.date(),
});

export class Promotion {
    public readonly vehicleId: string;
    public readonly durationDays: number;
    public readonly startDate: Date;
    public readonly totalCents: number;
    public readonly status: 'active' | 'pending_approval';
    public readonly paymentMethod: string;
    public readonly paidAt: Date | null;
    public readonly transactionId: string | null;
    public readonly transferCode: string | null;
    public readonly transferAlias: string | null;
    public readonly transferExpiresAt: Date | null;
    public readonly createdAt: Date = new Date();

    constructor(
        vehicleId: string,
        durationDays: PromotionDays,
        startDate: Date,
        paymentMethod: string,
        status: 'active' | 'pending_approval',
        paidAt: Date | null = null,
        transactionId: string | null = null,
        transferCode: string | null = null,
        transferAlias: string | null = null,
        transferExpiresAt: Date | null = null,
    ) {
        this.vehicleId = vehicleId;
        this.durationDays = durationDays.getDurationDays();
        this.startDate = startDate;
        this.totalCents = durationDays.getTotalCents();
        this.paymentMethod = paymentMethod;
        this.status = status;
        this.paidAt = paidAt;
        this.transactionId = transactionId;
        this.transferCode = transferCode;
        this.transferAlias = transferAlias;
        this.transferExpiresAt = transferExpiresAt;
        this.validate();
    }

    public confirmPayment(now: Date, transactionId: string): void {
        if (this.status !== 'pending_approval') {
            throw new InvalidEntityDataException('Promotion is not pending approval');
        }
        if (this.transferExpiresAt && now > this.transferExpiresAt) {
            throw new InvalidEntityDataException('Transfer has expired');
        }
        (this as any).status = 'active';
        (this as any).paidAt = now;
        (this as any).transactionId = transactionId;
    }

    public isExpired(now: Date = new Date()): boolean {
        if (this.status !== 'active') return false;
        const expiredAt = new Date(this.startDate.getTime() + this.durationDays * 24 * 60 * 60 * 1000);
        return now > expiredAt;
    }

    private validate(): void {
        const result = promotionSchema.safeParse({
            vehicleId: this.vehicleId,
            durationDays: this.durationDays,
            totalCents: this.totalCents,
            startDate: this.startDate,
            status: this.status,
            paymentMethod: this.paymentMethod,
            paidAt: this.paidAt,
            transactionId: this.transactionId,
            transferCode: this.transferCode,
            transferAlias: this.transferAlias,
            transferExpiresAt: this.transferExpiresAt,
            createdAt: this.createdAt,
        });
        if (!result.success) {
            throw new InvalidEntityDataException(result.error.issues[0].message);
        }
    }
}
