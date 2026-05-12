import { User } from '../entities/user.entity';

export interface UserRepository {
  save(user: User): Promise<void>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  markEmailVerified(id: string, verifiedAt: Date): Promise<void>;
  markPhoneVerified(id: string, verifiedAt: Date): Promise<void>;
  getVerificationStatus(id: string): Promise<{ email: boolean; phone: boolean }>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
