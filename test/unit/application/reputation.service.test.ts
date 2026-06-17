import { ReputationService } from '@/application/reputation.service';
import { ReputationRepository } from '@/domain/repositories/reputation.repository';
import { UserRepository } from '@/domain/repositories/user.repository';
import { PenaltyAlreadyAppliedException } from '@/domain/exceptions/reputation.exception';


describe('ReputationService', () => {
  let service: ReputationService;
  let reputationRepoMock: jest.Mocked<ReputationRepository>;
  let userRepoMock: jest.Mocked<UserRepository>;

  beforeEach(() => {
    reputationRepoMock = {
      getReputationData: jest.fn(),
      savePenalty: jest.fn(),
      findPenaltyByTicketAndUser: jest.fn(),
      updateScoreAndCounts: jest.fn(),
      updatePenaltyCountAndSuspension: jest.fn(),
      updateVehicleOwnerReputationScore: jest.fn(),
      getAverageRatingAsTarget: jest.fn(),
    };
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
    };

    service = new ReputationService(reputationRepoMock, userRepoMock);
  });

  describe('recalculateScore', () => {
    it('calculates average and updates reputation', async () => {
      reputationRepoMock.getAverageRatingAsTarget.mockResolvedValue({ avg: 4.5, count: 2 });
      reputationRepoMock.getReputationData.mockResolvedValue({
        id: '123',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        scoreAsDriver: 0,
        scoreAsRenter: 0,
        reviewCountAsDriver: 0,
        reviewCountAsRenter: 0,
        penaltyCountAsDriver: 0,
        penaltyCountAsRenter: 0,
        suspendedAsDriver: false,
        suspendedAsRenter: false,
      });

      await service.recalculateScore('123e4567-e89b-12d3-a456-426614174000', 'conductor');

      expect(reputationRepoMock.updateScoreAndCounts).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', 'conductor', 4.5, 2);
    });
  });

  describe('getReputation', () => {
    it('returns conductor_destacado badge if score >= 4.8', async () => {
      userRepoMock.findById.mockResolvedValue({} as any);
      reputationRepoMock.getReputationData.mockResolvedValue({
        id: '123',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        scoreAsDriver: 4.9,
        scoreAsRenter: 0,
        reviewCountAsDriver: 6,
        reviewCountAsRenter: 0,
        penaltyCountAsDriver: 0,
        penaltyCountAsRenter: 0,
        suspendedAsDriver: false,
        suspendedAsRenter: false,
      });

      const rep = await service.getReputation('123e4567-e89b-12d3-a456-426614174000');
      expect(rep.asDriver.badges).toContain('conductor_destacado');
      expect(rep.asDriver.score).toBe(4.9);
      expect(rep.asDriver.reviewCount).toBe(6);
    });

    it('returns lowReputation true if combined score < 3.5 with reviews', async () => {
      userRepoMock.findById.mockResolvedValue({} as any);
      reputationRepoMock.getReputationData.mockResolvedValue({
        id: '123',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        scoreAsDriver: 0,
        scoreAsRenter: 3.0,
        reviewCountAsDriver: 0,
        reviewCountAsRenter: 2,
        penaltyCountAsDriver: 0,
        penaltyCountAsRenter: 0,
        suspendedAsDriver: false,
        suspendedAsRenter: false,
      });

      const rep = await service.getReputation('123e4567-e89b-12d3-a456-426614174000');
      expect(rep.asRenter.isLowReputation).toBe(true);
      expect(rep.asRenter.score).toBe(3.0);
    });
  });

  describe('applyPenalty', () => {
    it('applies penalty, deducts score, and checks suspension', async () => {
      reputationRepoMock.findPenaltyByTicketAndUser.mockResolvedValue(null);
      reputationRepoMock.getReputationData.mockResolvedValue({
        id: '123',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        scoreAsDriver: 5.0,
        scoreAsRenter: 0,
        reviewCountAsDriver: 10,
        reviewCountAsRenter: 0,
        penaltyCountAsDriver: 2,
        penaltyCountAsRenter: 0,
        suspendedAsDriver: false,
        suspendedAsRenter: false,
      });

      await service.applyPenalty({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'conductor',
        reason: 'Bad behavior',
        scoreDeduction: 1.0,
        ticketId: '9e3cb198-d7b3-4f9e-bc43-2f8832a87a2a',
      });

      expect(reputationRepoMock.savePenalty).toHaveBeenCalled();
      expect(reputationRepoMock.updateScoreAndCounts).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', 'conductor', 4.0, 10, undefined);
      expect(reputationRepoMock.updatePenaltyCountAndSuspension).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', 'conductor', 3, true, undefined);
    });

    it('throws if penalty already exists', async () => {
      reputationRepoMock.findPenaltyByTicketAndUser.mockResolvedValue({} as any);

      await expect(
        service.applyPenalty({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          role: 'conductor',
          reason: 'Test',
          scoreDeduction: 0.5,
          ticketId: '9e3cb198-d7b3-4f9e-bc43-2f8832a87a2a',
        })
      ).rejects.toThrow(PenaltyAlreadyAppliedException);
    });

    it('deduplicates per (ticket, user), so both parties can be penalized on the same ticket', async () => {
      const ticketId = '9e3cb198-d7b3-4f9e-bc43-2f8832a87a2a';
      // No existe penalización previa para ninguno de los dos usuarios.
      reputationRepoMock.findPenaltyByTicketAndUser.mockResolvedValue(null);
      reputationRepoMock.getReputationData.mockResolvedValue({
        id: '1', userId: 'x', scoreAsDriver: 5, scoreAsRenter: 5,
        reviewCountAsDriver: 0, reviewCountAsRenter: 0,
        penaltyCountAsDriver: 0, penaltyCountAsRenter: 0,
        suspendedAsDriver: false, suspendedAsRenter: false,
      });

      const conductorId = '11111111-1111-4111-8111-111111111111';
      const rentadorId = '22222222-2222-4222-8222-222222222222';
      await service.applyPenalty({ userId: conductorId, role: 'conductor', reason: 'fallo de prueba', scoreDeduction: 1, ticketId });
      await service.applyPenalty({ userId: rentadorId, role: 'rentador', reason: 'fallo de prueba', scoreDeduction: 1, ticketId });

      // La dedup consulta por (ticketId, userId), no solo por ticketId.
      expect(reputationRepoMock.findPenaltyByTicketAndUser).toHaveBeenCalledWith(ticketId, conductorId, undefined);
      expect(reputationRepoMock.findPenaltyByTicketAndUser).toHaveBeenCalledWith(ticketId, rentadorId, undefined);
      expect(reputationRepoMock.savePenalty).toHaveBeenCalledTimes(2);
    });
  });
});
