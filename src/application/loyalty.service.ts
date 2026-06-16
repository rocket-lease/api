import { Inject, Injectable } from '@nestjs/common';
import { type LevelUpInfo, type BenefitInfo } from '@rocket-lease/contracts';
import { LOYALTY_REPOSITORY, LoyaltyRepository } from '@/domain/repositories/loyalty.repository';
import { USER_REPOSITORY, type UserRepository } from '@/domain/repositories/user.repository';
import { NOTIFICATION_PROVIDER, type NotificationProvider } from '@/domain/providers/notification.provider';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { LoyaltyProfile } from '@/domain/entities/loyalty-profile.entity';
import { ExperienceTransaction } from '@/domain/entities/experience-transaction.entity';
import { ExperienceAlreadyClaimedException } from '@/domain/exceptions/loyalty.exception';
import { XP_REWARDS, getLevelDef, getNextLevelDef, getBenefitsForLevel } from '@/application/loyalty-config';

@Injectable()
export class LoyaltyService {
  constructor(
    @Inject(LOYALTY_REPOSITORY)
    private readonly repo: LoyaltyRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: UserRepository,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async registerPendingReservation(
    conductorId: string,
    reservationId: string,
    vehicleName: string,
    vehicleId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<void> {
    const profile = await this.findOrCreateProfile(conductorId);
    const amount = XP_REWARDS.RESERVATION_COMPLETED;
    profile.addPendingXp(amount);
    const tx = new ExperienceTransaction({
      profileId: profile.getId(),
      amount,
      reservationId,
      reservationVehicleName: vehicleName,
      reservationVehicleId: vehicleId,
      reservationStartAt: startAt,
      reservationEndAt: endAt,
      status: 'pending',
      createdAt: this.clock.now(),
    });
    await this.repo.save(profile);
    await this.repo.saveTransaction(tx);
  }

  async claimXpFromReview(
    conductorId: string,
    reservationId: string,
  ): Promise<LevelUpInfo | null> {
    const profile = await this.findOrCreateProfile(conductorId);

    const pendingTx = await this.repo.findTransactionByReservationId(
      reservationId,
    );
    if (!pendingTx || pendingTx.getStatus() === 'claimed') {
      throw new ExperienceAlreadyClaimedException('review', reservationId);
    }

    const amount = pendingTx.getAmount();
    profile.claimPendingXp(amount);
    pendingTx.claim();

    const levelUp = this.evaluateLevelUp(profile);

    if (levelUp.didLevelUp) {
      profile.setLevel(levelUp.newLevel);
      await this.syncUserLevel(conductorId, levelUp.newLevel);
      await this.sendLevelUpNotification(conductorId, levelUp.newLevel);
    }

    await this.repo.save(profile);
    await this.repo.saveTransaction(pendingTx);

    if (!levelUp.didLevelUp) return null;

    return {
      oldLevel: levelUp.oldLevel as LevelUpInfo['oldLevel'],
      newLevel: levelUp.newLevel as LevelUpInfo['newLevel'],
      benefits: levelUp.benefits,
    };
  }

  async getProfile(conductorId: string) {
    const profile = await this.findOrCreateProfile(conductorId);
    return profile.toProfile();
  }

  async getTransactions(conductorId: string): Promise<ExperienceTransaction[]> {
    const profile = await this.repo.findByConductorId(conductorId);
    if (!profile) return [];
    return this.repo.findTransactionsByProfileId(profile.getId());
  }

  async getPublicLevel(userId: string): Promise<{ level: string }> {
    const user = await this.userRepo.getProfileById(userId);
    return { level: user?.level ?? 'bronze' };
  }

  async getDiscountPercentage(conductorId: string): Promise<number> {
    const profile = await this.repo.findByConductorId(conductorId);
    if (!profile) return 0;
    const levelDef = getLevelDef(profile.getLevel());
    return levelDef?.discount ?? 0;
  }

  private async findOrCreateProfile(conductorId: string): Promise<LoyaltyProfile> {
    const existing = await this.repo.findByConductorId(conductorId);
    if (existing) return existing;

    const profile = new LoyaltyProfile({
      conductorId,
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    });
    await this.repo.save(profile);
    return profile;
  }

  private evaluateLevelUp(profile: LoyaltyProfile): {
    didLevelUp: boolean;
    oldLevel: string;
    newLevel: string;
    benefits: BenefitInfo[];
  } {
    const currentDef = getLevelDef(profile.getLevel());
    const nextDef = getNextLevelDef(profile.getLevel());

    if (!nextDef || profile.getTotalXp() < nextDef.minXp) {
      return {
        didLevelUp: false,
        oldLevel: profile.getLevel(),
        newLevel: profile.getLevel(),
        benefits: [],
      };
    }

    let newTier = profile.getLevel();
    for (let i = currentDef!.sortOrder + 1; i < getLevelDef('platinum')!.sortOrder + 1; i++) {
      const candidate = getLevelDef(['bronze', 'silver', 'gold', 'platinum'][i]);
      if (candidate && profile.getTotalXp() >= candidate.minXp) {
        newTier = candidate.tier;
      } else {
        break;
      }
    }

    return {
      didLevelUp: newTier !== profile.getLevel(),
      oldLevel: profile.getLevel(),
      newLevel: newTier,
      benefits: getBenefitsForLevel(newTier),
    };
  }

  private async syncUserLevel(conductorId: string, newLevel: string): Promise<void> {
    await this.userRepo.updateLevel(conductorId, newLevel);
  }

  private async sendLevelUpNotification(conductorId: string, newLevel: string): Promise<void> {
    const levelDef = getLevelDef(newLevel);
    const label = levelDef?.badgeLabel ?? newLevel;
    await this.notificationProvider.notify(
      conductorId,
      '¡Subiste de nivel!',
      `Felicidades, alcanzaste el nivel ${label}.`,
    );
  }
}
