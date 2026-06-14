import { LoyaltyService } from '@/application/loyalty.service';
import { LoyaltyRepository } from '@/domain/repositories/loyalty.repository';
import { UserRepository } from '@/domain/repositories/user.repository';
import { NotificationProvider } from '@/domain/providers/notification.provider';
import { type Clock } from '@/domain/providers/clock.provider';
import { LoyaltyProfile } from '@/domain/entities/loyalty-profile.entity';
import { ExperienceTransaction } from '@/domain/entities/experience-transaction.entity';
import { ExperienceAlreadyClaimedException } from '@/domain/exceptions/loyalty.exception';
import { randomUUID } from 'crypto';

const conductorId = randomUUID();
const reservationId = randomUUID();
const vehicleId = randomUUID();
const startAt = new Date('2026-06-10T10:00:00Z');
const endAt = new Date('2026-06-12T10:00:00Z');

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let repoMock: jest.Mocked<LoyaltyRepository>;
  let userRepoMock: jest.Mocked<UserRepository>;
  let notificationMock: jest.Mocked<NotificationProvider>;
  let clockMock: jest.Mocked<Clock>;

  beforeEach(() => {
    const now = new Date('2026-06-13T12:00:00Z');

    repoMock = {
      findByConductorId: jest.fn(),
      save: jest.fn(),
      findTransactionsByProfileId: jest.fn(),
      saveTransaction: jest.fn(),
      findTransactionByReservationId: jest.fn(),
    } as any;

    userRepoMock = {
      save: jest.fn(),
      updateBasicInfo: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      getProfileById: jest.fn(),
      findProfilesByIds: jest.fn(),
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      creditBalance: jest.fn(),
      deleteById: jest.fn(),
      markPhoneVerified: jest.fn(),
      isPhoneVerified: jest.fn(),
      updateAutoAccept: jest.fn(),
      applyReputationPenalty: jest.fn(),
      updateLevel: jest.fn(),
    } as any;

    notificationMock = {
      notify: jest.fn(),
    };

    clockMock = { now: jest.fn().mockReturnValue(now) };

    service = new LoyaltyService(repoMock, userRepoMock, notificationMock, clockMock);
  });

  // ─── registerPendingReservation ─────────────────────────────────────────────

  describe('registerPendingReservation', () => {
    it('crea perfil si no existe y guarda transacción pending', async () => {
      repoMock.findByConductorId.mockResolvedValue(null);

      await service.registerPendingReservation(conductorId, reservationId, 'Toyota Corolla', vehicleId, startAt, endAt);

      expect(repoMock.findByConductorId).toHaveBeenCalledWith(conductorId);
      expect(repoMock.save).toHaveBeenCalledTimes(2);
      // 1ra save: findOrCreateProfile crea el perfil. 2da: registerPendingReservation actualiza pendingXp.
      const savedProfile = repoMock.save.mock.calls[1][0] as LoyaltyProfile;
      expect(savedProfile.getPendingXp()).toBe(10);
      expect(savedProfile.getTotalXp()).toBe(0);

      const savedTx = repoMock.saveTransaction.mock.calls[0][0] as ExperienceTransaction;
      expect(savedTx.getAmount()).toBe(10);
      expect(savedTx.getStatus()).toBe('pending');
      expect(savedTx.getReservationId()).toBe(reservationId);
      expect(savedTx.getReservationVehicleName()).toBe('Toyota Corolla');
      expect(savedTx.getReservationVehicleId()).toBe(vehicleId);
    });

    it('usa perfil existente si ya existe', async () => {
      const existing = new LoyaltyProfile({ conductorId, pendingXp: 5 });
      repoMock.findByConductorId.mockResolvedValue(existing);

      await service.registerPendingReservation(conductorId, reservationId, 'Toyota Corolla', vehicleId, startAt, endAt);

      expect(repoMock.save).toHaveBeenCalledTimes(1);
      const savedProfile = repoMock.save.mock.calls[0][0] as LoyaltyProfile;
      expect(savedProfile.getPendingXp()).toBe(15);
    });
  });

  // ─── claimXpFromReview ──────────────────────────────────────────────────────

  describe('claimXpFromReview', () => {
    it('reclama XP de transacción pending y devuelve levelUp si corresponde', async () => {
      const profile = new LoyaltyProfile({ conductorId, pendingXp: 10 });
      repoMock.findByConductorId.mockResolvedValue(profile);

      const pendingTx = new ExperienceTransaction({
        profileId: profile.getId(),
        amount: 10,
        reservationId,
        reservationVehicleName: 'Toyota Corolla',
        reservationVehicleId: vehicleId,
        reservationStartAt: startAt,
        reservationEndAt: endAt,
        status: 'pending',
      });
      repoMock.findTransactionByReservationId.mockResolvedValue(pendingTx);

      // 10 XP → de bronze a bronze (no level up, minXp for silver is 30)
      const result = await service.claimXpFromReview(conductorId, reservationId);

      expect(pendingTx.getStatus()).toBe('claimed');
      expect(profile.getTotalXp()).toBe(10);
      expect(profile.getPendingXp()).toBe(0);
      expect(repoMock.save).toHaveBeenCalledWith(profile);
      expect(repoMock.saveTransaction).toHaveBeenCalledWith(pendingTx);
      expect(result).toBeNull();
    });

    it('lanza ExperienceAlreadyClaimedException si ya fue reclamada', async () => {
      const profile = new LoyaltyProfile({ conductorId, pendingXp: 10 });
      repoMock.findByConductorId.mockResolvedValue(profile);

      const claimedTx = new ExperienceTransaction({
        profileId: profile.getId(),
        amount: 10,
        reservationId,
        reservationVehicleName: 'Toyota Corolla',
        reservationVehicleId: vehicleId,
        reservationStartAt: startAt,
        reservationEndAt: endAt,
        status: 'claimed',
      });
      repoMock.findTransactionByReservationId.mockResolvedValue(claimedTx);

      await expect(
        service.claimXpFromReview(conductorId, reservationId),
      ).rejects.toThrow(ExperienceAlreadyClaimedException);
    });

    it('lanza ExperienceAlreadyClaimedException si no hay transacción', async () => {
      const profile = new LoyaltyProfile({ conductorId, pendingXp: 10 });
      repoMock.findByConductorId.mockResolvedValue(profile);
      repoMock.findTransactionByReservationId.mockResolvedValue(null);

      await expect(
        service.claimXpFromReview(conductorId, reservationId),
      ).rejects.toThrow(ExperienceAlreadyClaimedException);
    });

    it('sube de nivel cuando alcanza el mínimo de XP', async () => {
      // Silver necesita 30 XP. Dar 10 de la reserva + 20 previos = 30 total.
      const profile = new LoyaltyProfile({ conductorId, level: 'bronze', totalXp: 20, pendingXp: 10 });
      repoMock.findByConductorId.mockResolvedValue(profile);

      const pendingTx = new ExperienceTransaction({
        profileId: profile.getId(),
        amount: 10,
        reservationId,
        reservationVehicleName: 'Toyota Corolla',
        reservationVehicleId: vehicleId,
        reservationStartAt: startAt,
        reservationEndAt: endAt,
        status: 'pending',
      });
      repoMock.findTransactionByReservationId.mockResolvedValue(pendingTx);
      userRepoMock.getProfileById.mockResolvedValue({ id: conductorId, level: 'bronze' } as any);
      userRepoMock.updateLevel.mockResolvedValue(undefined);

      const result = await service.claimXpFromReview(conductorId, reservationId);

      expect(profile.getLevel()).toBe('silver');
      expect(profile.getTotalXp()).toBe(30);
      expect(userRepoMock.updateLevel).toHaveBeenCalledWith(conductorId, 'silver');
      expect(notificationMock.notify).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result!.oldLevel).toBe('bronze');
      expect(result!.newLevel).toBe('silver');
      expect(result!.benefits.length).toBeGreaterThan(0);
    });

    it('no sube de nivel si no alcanza el mínimo', async () => {
      const profile = new LoyaltyProfile({ conductorId, level: 'bronze', totalXp: 0, pendingXp: 10 });
      repoMock.findByConductorId.mockResolvedValue(profile);

      const pendingTx = new ExperienceTransaction({
        profileId: profile.getId(),
        amount: 10,
        reservationId,
        reservationVehicleName: 'Toyota Corolla',
        reservationVehicleId: vehicleId,
        reservationStartAt: startAt,
        reservationEndAt: endAt,
        status: 'pending',
      });
      repoMock.findTransactionByReservationId.mockResolvedValue(pendingTx);

      const result = await service.claimXpFromReview(conductorId, reservationId);

      expect(profile.getLevel()).toBe('bronze');
      expect(result).toBeNull();
    });
  });

  // ─── getProfile ─────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('devuelve perfil existente', async () => {
      const profile = new LoyaltyProfile({ conductorId, totalXp: 50 });
      repoMock.findByConductorId.mockResolvedValue(profile);

      const result = await service.getProfile(conductorId);
      expect(result.conductorId).toBe(conductorId);
      expect(result.level).toBe('bronze');
      expect(result.totalXp).toBe(50);
    });

    it('crea y devuelve perfil nuevo si no existe', async () => {
      repoMock.findByConductorId.mockResolvedValue(null);

      const result = await service.getProfile(conductorId);
      expect(result.conductorId).toBe(conductorId);
      expect(result.level).toBe('bronze');
      expect(repoMock.save).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getTransactions ────────────────────────────────────────────────────────

  describe('getTransactions', () => {
    it('devuelve transacciones del perfil', async () => {
      const profile = new LoyaltyProfile({ conductorId });
      repoMock.findByConductorId.mockResolvedValue(profile);
      repoMock.findTransactionsByProfileId.mockResolvedValue([
        new ExperienceTransaction({
          profileId: profile.getId(),
          amount: 10,
          reservationId,
          reservationVehicleName: 'Toyota Corolla',
          reservationVehicleId: vehicleId,
          reservationStartAt: startAt,
          reservationEndAt: endAt,
          status: 'pending',
        }),
      ]);

      const txs = await service.getTransactions(conductorId);
      expect(txs).toHaveLength(1);
      expect(txs[0].getReservationId()).toBe(reservationId);
    });

    it('devuelve array vacío si no hay perfil', async () => {
      repoMock.findByConductorId.mockResolvedValue(null);
      const txs = await service.getTransactions(conductorId);
      expect(txs).toEqual([]);
    });
  });

  // ─── getDiscountPercentage ──────────────────────────────────────────────────

  describe('getDiscountPercentage', () => {
    it('devuelve 0 si no hay perfil', async () => {
      repoMock.findByConductorId.mockResolvedValue(null);
      const result = await service.getDiscountPercentage(conductorId);
      expect(result).toBe(0);
    });

    it('devuelve descuento según nivel', async () => {
      const profile = new LoyaltyProfile({ conductorId, level: 'silver' });
      repoMock.findByConductorId.mockResolvedValue(profile);
      const result = await service.getDiscountPercentage(conductorId);
      expect(result).toBe(5);
    });

    it('platinum devuelve 15', async () => {
      const profile = new LoyaltyProfile({ conductorId, level: 'platinum' });
      repoMock.findByConductorId.mockResolvedValue(profile);
      const result = await service.getDiscountPercentage(conductorId);
      expect(result).toBe(15);
    });
  });

  // ─── getPublicLevel ─────────────────────────────────────────────────────────

  describe('getPublicLevel', () => {
    it('devuelve nivel del usuario', async () => {
      userRepoMock.getProfileById.mockResolvedValue({ id: conductorId, level: 'gold' } as any);
      const result = await service.getPublicLevel(conductorId);
      expect(result).toEqual({ level: 'gold' });
    });

    it('devuelve bronze si no hay usuario', async () => {
      userRepoMock.getProfileById.mockResolvedValue(null);
      const result = await service.getPublicLevel(conductorId);
      expect(result).toEqual({ level: 'bronze' });
    });
  });
});
