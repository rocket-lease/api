import { SavedPaymentMethod } from '@rocket-lease/contracts';

export interface CreatePaymentMethodData {
  userId: string;
  type: 'card' | 'digital_wallet';
  details: unknown;
  isDefault?: boolean;
}

export interface UpdatePaymentMethodData {
  details?: unknown;
  isDefault?: boolean;
}

export interface PaymentMethodRepository {
  create(data: CreatePaymentMethodData): Promise<SavedPaymentMethod>;
  findById(id: string): Promise<SavedPaymentMethod | null>;
  findByUserId(userId: string): Promise<SavedPaymentMethod[]>;
  update(id: string, data: UpdatePaymentMethodData): Promise<SavedPaymentMethod>;
  delete(id: string): Promise<void>;
}

export const PAYMENT_METHOD_REPOSITORY = Symbol('PaymentMethodRepository');
