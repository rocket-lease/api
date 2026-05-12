import { Injectable } from '@nestjs/common';
import { User } from '@/domain/entities/user.entity';
import { UserRepository } from '@/domain/repositories/user.repository';

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly storage: Map<string, User> = new Map();
  private readonly verified: Map<string, { email: Date | null; phone: Date | null }> = new Map();

  public async save(user: User): Promise<void> {
    this.storage.set(user.getEmail(), user);
    this.verified.set(user.getId(), { email: null, phone: null });
  }

  public async findByEmail(email: string): Promise<User | null> {
    return this.storage.get(email) ?? null;
  }

  public async findById(id: string): Promise<User | null> {
    for (const user of this.storage.values()) {
      if (user.getId() === id) return user;
    }
    return null;
  }

  public async markEmailVerified(id: string, verifiedAt: Date): Promise<void> {
    const v = this.verified.get(id) ?? { email: null, phone: null };
    v.email = verifiedAt;
    this.verified.set(id, v);
  }

  public async markPhoneVerified(id: string, verifiedAt: Date): Promise<void> {
    const v = this.verified.get(id) ?? { email: null, phone: null };
    v.phone = verifiedAt;
    this.verified.set(id, v);
  }

  public async getVerificationStatus(
    id: string,
  ): Promise<{ email: boolean; phone: boolean }> {
    const v = this.verified.get(id);
    return { email: !!v?.email, phone: !!v?.phone };
  }

  public async clean(): Promise<void> {
    this.storage.clear();
    this.verified.clear();
  }
}
