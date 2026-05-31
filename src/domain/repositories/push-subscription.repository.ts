export interface PushSubscriptionData {
  id: string;
  userId: string;
  endpoint: string;
  auth: string;
  p256dh: string;
}

export interface PushSubscriptionRepository {
  save(data: Omit<PushSubscriptionData, 'id'>): Promise<PushSubscriptionData>;
  findByUserId(userId: string): Promise<PushSubscriptionData[]>;
  deleteByEndpoint(endpoint: string): Promise<void>;
}

export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol('PushSubscriptionRepository');
