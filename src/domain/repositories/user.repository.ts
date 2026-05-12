import { User } from '../entities/user.entity';

export type VerificationStatus = 'unverified' | 'pending' | 'verified';
export type UserLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface VehiclePreferences {
  transmission: 'automatic' | 'manual' | null;
  accessibility: string[];
  maxPriceDaily: number | null;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  verificationStatus: VerificationStatus;
  level: UserLevel;
  reputationScore: number;
  preferences: VehiclePreferences;
}

export interface UpdateUserProfile {
  name: string;
  phone: string;
  avatarUrl: string | null;
  preferences: VehiclePreferences;
}

export interface UserRepository {
  save(user: User): Promise<void>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  getProfileById(id: string): Promise<UserProfile | null>;
  updateProfile(id: string, profile: UpdateUserProfile): Promise<UserProfile>;
  updateAvatar(id: string, avatarUrl: string): Promise<UserProfile>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
