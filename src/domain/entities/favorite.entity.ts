import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { InvalidEntityDataException } from '../exceptions/domain.exception';

const favoriteSchema = z.object({
  id: z.string().uuid(),
  conductorId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  createdAt: z.date(),
});

export class Favorite {
  constructor(
    public readonly id: string = randomUUID(),
    public readonly conductorId: string,
    public readonly vehicleId: string,
    public readonly createdAt: Date = new Date(),
  ) {
    this.validate();
  }

  private validate(): void {
    const result = favoriteSchema.safeParse({
      id: this.id,
      conductorId: this.conductorId,
      vehicleId: this.vehicleId,
      createdAt: this.createdAt,
    });
    if (!result.success) {
      throw new InvalidEntityDataException(result.error.issues[0].message);
    }
  }
}
