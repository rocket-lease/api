import { Injectable } from '@nestjs/common';
import { User } from '@/domain/entities/user.entity';
import {
  UserRepository,
  UserProfile,
  UpdateUserProfile,
} from '@/domain/repositories/user.repository';

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly storageByEmail: Map<string, User> = new Map();
  private readonly storageById: Map<string, User> = new Map();
  private readonly profiles: Map<string, UserProfile> = new Map();

  public async save(user: User): Promise<void> {
    this.storageByEmail.set(user.getEmail(), user);
    this.storageById.set(user.getId(), user);
    this.profiles.set(user.getId(), {
      id: user.getId(),
      name: user.getName(),
      email: user.getEmail(),
      phone: user.getPhone(),
      avatarUrl: null,
      verificationStatus: 'pending',
      level: 'bronze',
      reputationScore: 0,
      preferences: {
        transmission: null,
        accessibility: [],
        maxPriceDaily: null,
      },
    });
  }

  public async findByEmail(email: string): Promise<User | null> {
    return this.storageByEmail.get(email) ?? null;
  }

  public async findById(id: string): Promise<User | null> {
    return this.storageById.get(id) ?? null;
  }

  public async getProfileById(id: string): Promise<UserProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  public async updateProfile(id: string, profile: UpdateUserProfile): Promise<UserProfile> {
    const existing = this.profiles.get(id);
    if (!existing) {
      throw new Error('User profile not found');
    }

    const nextProfile: UserProfile = {
      ...existing,
      name: profile.name,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
      preferences: profile.preferences,
    };

    this.profiles.set(id, nextProfile);
    return nextProfile;
  }

  public async updateAvatar(id: string, avatarUrl: string): Promise<UserProfile> {
    const existing = this.profiles.get(id);
    if (!existing) {
      throw new Error('User profile not found');
    }

    const nextProfile: UserProfile = {
      ...existing,
      avatarUrl,
    };

    this.profiles.set(id, nextProfile);
    return nextProfile;
  }

  public async clean(): Promise<void> {
    this.storageByEmail.clear();
    this.storageById.clear();
    this.profiles.clear();
  }
}
