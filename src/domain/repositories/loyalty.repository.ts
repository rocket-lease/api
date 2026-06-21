import { LoyaltyProfile } from '../entities/loyalty-profile.entity';
import { ExperienceTransaction } from '../entities/experience-transaction.entity';

export const LOYALTY_REPOSITORY = Symbol('LOYALTY_REPOSITORY');

export abstract class LoyaltyRepository {
  abstract findByConductorId(conductorId: string): Promise<LoyaltyProfile | null>;
  abstract save(profile: LoyaltyProfile): Promise<void>;
  abstract findTransactionsByProfileId(profileId: string): Promise<ExperienceTransaction[]>;
  abstract saveTransaction(tx: ExperienceTransaction): Promise<void>;
  abstract findTransactionByReservationId(reservationId: string): Promise<ExperienceTransaction | null>;
}
