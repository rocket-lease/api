import { Injectable } from '@nestjs/common';
import { User } from '@/domain/entities/user.entity';
import { UserRepository } from '@/domain/repositories/user.repository';

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly storage: Map<string, User> = new Map();

  public async save(user: User): Promise<void> {
    this.storage.set(user.getEmail(), user);
  }

  public async findByEmail(email: string): Promise<User | null> {
    return this.storage.get(email) ?? null;
  }

  public async clean(): Promise<void> {
    this.storage.clear();
  }
}
