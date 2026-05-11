import { z } from 'zod';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const userSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email format'),
  dni: z.string().regex(/^\d{7,8}$/, 'DNI must contain 7 or 8 digits'),
  phone: z.string().trim().min(1, 'Phone is required').max(20),
});

export class User {
  constructor(
    private readonly id: string,
    private readonly name: string,
    private readonly email: string,
    private readonly dni: string,
    private readonly phone: string,
  ) {
    this.validate();
  }

  private validate(): void {
    const result = userSchema.safeParse({
      name: this.name,
      email: this.email,
      dni: this.dni.replace(/\./g, ''),
      phone: this.phone,
    });

    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }

  public getId(): string {
    return this.id;
  }
  public getName(): string {
    return this.name;
  }
  public getEmail(): string {
    return this.email;
  }
  public getDni(): string {
    return this.dni;
  }
  public getPhone(): string {
    return this.phone;
  }
}
