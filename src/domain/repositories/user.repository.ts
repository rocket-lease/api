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
  autoAccept: boolean;
}

export interface UpdateUserProfile {
  name: string;
  phone: string;
  avatarUrl: string | null;
  preferences: VehiclePreferences;
  autoAccept?: boolean;
}

export interface UserRepository {
  save(user: User): Promise<void>;
  updateBasicInfo(
    id: string,
    data: { name: string; dni: string; phone: string },
  ): Promise<void>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  getProfileById(id: string): Promise<UserProfile | null>;
  findProfilesByIds(ids: string[]): Promise<UserProfile[]>;
  updateProfile(id: string, profile: UpdateUserProfile): Promise<UserProfile>;
  updateAvatar(id: string, avatarUrl: string): Promise<UserProfile>;
  deleteById(id: string): Promise<void>;
  markPhoneVerified(id: string, verifiedAt: Date): Promise<void>;
  isPhoneVerified(id: string): Promise<boolean>;
  /**
   * Actualiza el flag global de auto-aceptación de reservas del usuario rentador.
   * No toca el resto del perfil — atomic per US-40 (US-46 fue manual approval por default).
   */
  updateAutoAccept(id: string, value: boolean): Promise<void>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
