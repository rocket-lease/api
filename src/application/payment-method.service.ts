import { Inject, Injectable } from '@nestjs/common';
import {
  CreateSavedPaymentMethod,
  UpdateSavedPaymentMethod,
  SavedPaymentMethod,
} from '@rocket-lease/contracts';
import { PAYMENT_METHOD_REPOSITORY } from '@/domain/repositories/payment-method.repository';
import type { PaymentMethodRepository } from '@/domain/repositories/payment-method.repository';
import { InvalidEntityDataException } from '@/domain/exceptions/domain.exception';

@Injectable()
export class PaymentMethodService {
  constructor(
    @Inject(PAYMENT_METHOD_REPOSITORY)
    private readonly paymentMethodRepository: PaymentMethodRepository,
  ) {}

  public async getMyPaymentMethods(userId: string): Promise<SavedPaymentMethod[]> {
    return this.paymentMethodRepository.findByUserId(userId);
  }

  public async createPaymentMethod(
    userId: string,
    dto: CreateSavedPaymentMethod,
  ): Promise<SavedPaymentMethod> {
    const existing = await this.paymentMethodRepository.findByUserId(userId);
    const isFirst = existing.length === 0;

    return this.paymentMethodRepository.create({
      userId,
      type: dto.type,
      details: dto.details,
      isDefault: isFirst, // First method is always default
    });
  }

  public async updatePaymentMethod(
    userId: string,
    id: string,
    dto: UpdateSavedPaymentMethod,
  ): Promise<SavedPaymentMethod> {
    const existing = await this.paymentMethodRepository.findById(id);
    if (!existing) {
      throw new InvalidEntityDataException('Payment method not found');
    }

    const userMethods = await this.paymentMethodRepository.findByUserId(userId);
    if (!userMethods.some((m) => m.id === id)) {
      throw new InvalidEntityDataException('Payment method not found');
    }

    if (existing.type !== dto.type) {
      throw new InvalidEntityDataException('Cannot change payment method type');
    }

    const mergedDetails = { ...existing.details, ...dto.details };

    return this.paymentMethodRepository.update(id, {
      details: mergedDetails,
    });
  }

  public async deletePaymentMethod(userId: string, id: string): Promise<void> {
    const userMethods = await this.paymentMethodRepository.findByUserId(userId);
    if (!userMethods.some((m) => m.id === id)) {
      throw new InvalidEntityDataException('Payment method not found');
    }

    await this.paymentMethodRepository.delete(id);
  }
}
