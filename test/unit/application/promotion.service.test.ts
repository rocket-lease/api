import { randomUUID } from 'node:crypto';
import { PromotionService } from '@/application/promotion.service';
import { Promotion } from '@/domain/entities/promotion/promotion.entity';
import { PromotionDays } from '@/domain/entities/promotion/promotion.days.entity';
import { Vehicle } from '@/domain/entities/vehicle.entity';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import { VehicleAlreadyPromoted } from '@/domain/exceptions/promotion.exception';
import type { PromotionRepository, PromotionDuration } from '@/domain/repositories/promotion.repository';
import type { VehicleRepository } from '@/domain/repositories/vehicle.repository';
import type { PaymentGatewayProvider } from '@/domain/providers/payment-gateway.provider';
import type { Clock } from '@/domain/providers/clock.provider';

class FakeClock implements Clock {
  constructor(private date: Date) {}

  now(): Date {
    return this.date;
  }

  set(date: Date): void {
    this.date = date;
  }
}

function makeVehicle(ownerId: string): Vehicle {
  return new Vehicle(
    randomUUID(),
    ownerId,
    'ABC123',
    'Toyota',
    'Corolla',
    2020,
    5,
    400,
    'Automatico',
    false,
    true,
    ['https://example.com/photo.jpg'],
    ['GPS', 'BLUETOOTH'],
    'Silver',
    15000,
    500000,
    [],
    'A comfortable sedan',
    'Buenos Aires',
    'San Isidro',
    '2024-01-01',
  );
}

function makePromotionDuration(days = 7, valueInCents = 70000): PromotionDuration {
  return { days, valueInCents };
}

describe('PromotionService', () => {
  let service: PromotionService;
  let promotionRepoMock: jest.Mocked<PromotionRepository>;
  let vehicleRepoMock: jest.Mocked<VehicleRepository>;
  let paymentGatewayMock: jest.Mocked<PaymentGatewayProvider>;
  let clock: FakeClock;

  beforeEach(() => {
    promotionRepoMock = {
      save: jest.fn(),
      findByVehicleId: jest.fn(),
      findAllActive: jest.fn(),
      delete: jest.fn(),
      findAllDurations: jest.fn(),
    };

    vehicleRepoMock = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findByOwnerId: jest.fn(),
      fetchAll: jest.fn(),
      findByIds: jest.fn(),
      findByPlate: jest.fn(),
      findByCharacteristics: jest.fn(),
      bulkUpdatePrices: jest.fn(),
      countActiveReservationsByVehicleIds: jest.fn(),
      findEnabledVehicles: jest.fn(),
    };

    paymentGatewayMock = {
      processPayment: jest.fn(),
      generateTransferCode: jest.fn(),
    };

    clock = new FakeClock(new Date('2024-06-01T10:00:00Z'));

    service = new PromotionService(
      promotionRepoMock,
      vehicleRepoMock,
      paymentGatewayMock,
      clock,
    );
  });

  describe('getDurations', () => {
    it('retorna las duraciones disponibles', async () => {
      const durations = [
        makePromotionDuration(7, 70000),
        makePromotionDuration(14, 130000),
        makePromotionDuration(30, 250000),
      ];
      promotionRepoMock.findAllDurations.mockResolvedValue(durations);

      const result = await service.getDurations();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ days: 7, valueInCents: 70000 });
      expect(result[1]).toEqual({ days: 14, valueInCents: 130000 });
      expect(result[2]).toEqual({ days: 30, valueInCents: 250000 });
      expect(promotionRepoMock.findAllDurations).toHaveBeenCalledTimes(1);
    });
  });

  describe('promoteVehicle (credit_card)', () => {
    it('promueve el vehículo y lo marca como activo', async () => {
      const ownerId = randomUUID();
      const vehicleId = randomUUID();
      const vehicle = makeVehicle(ownerId);

      vehicleRepoMock.findById.mockResolvedValue(vehicle);
      promotionRepoMock.findByVehicleId.mockResolvedValue(null);
      promotionRepoMock.findAllDurations.mockResolvedValue([makePromotionDuration(7, 70000)]);
      paymentGatewayMock.processPayment.mockResolvedValue({
        success: true,
        transactionId: 'txn-123',
      });
      promotionRepoMock.save.mockResolvedValue(
        new Promotion(
          vehicleId,
          new PromotionDays(7, 70000),
          clock.now(),
          'credit_card',
          'active',
          clock.now(),
          'txn-123',
        ),
      );

      const result = await service.promoteVehicle(ownerId, vehicleId, {
        durationDays: 7,
        startDate: clock.now().toISOString(),
        paymentMethod: 'credit_card',
      });

      expect(vehicleRepoMock.findById).toHaveBeenCalledWith(vehicleId);
      expect(promotionRepoMock.findByVehicleId).toHaveBeenCalledWith(vehicleId);
      expect(promotionRepoMock.findAllDurations).toHaveBeenCalled();
      expect(paymentGatewayMock.processPayment).toHaveBeenCalledWith(70000, 'ARS', 'credit_card');
      expect(promotionRepoMock.save).toHaveBeenCalledWith(expect.any(Promotion));
      expect(result.status).toBe('active');
      expect(result.vehicleId).toBe(vehicleId);
      expect(result.totalCents).toBe(70000);
      expect((result as any).transactionId).toBe('txn-123');
    });

    it('lanza EntityNotFoundException si el vehículo no existe', async () => {
      const ownerId = randomUUID();
      const vehicleId = randomUUID();

      vehicleRepoMock.findById.mockResolvedValue(null);

      await expect(
        service.promoteVehicle(ownerId, vehicleId, {
          durationDays: 7,
          startDate: clock.now().toISOString(),
          paymentMethod: 'credit_card',
        }),
      ).rejects.toThrow(EntityNotFoundException);

      expect(promotionRepoMock.save).not.toHaveBeenCalled();
    });

    it('lanza EntityNotFoundException si el owner no coincide', async () => {
      const ownerId = randomUUID();
      const differentOwnerId = randomUUID();
      const vehicleId = randomUUID();
      const vehicle = makeVehicle(differentOwnerId);

      vehicleRepoMock.findById.mockResolvedValue(vehicle);

      await expect(
        service.promoteVehicle(ownerId, vehicleId, {
          durationDays: 7,
          startDate: clock.now().toISOString(),
          paymentMethod: 'credit_card',
        }),
      ).rejects.toThrow(EntityNotFoundException);

      expect(promotionRepoMock.save).not.toHaveBeenCalled();
    });

    it('lanza VehicleAlreadyPromoted si ya tiene una promoción activa', async () => {
      const ownerId = randomUUID();
      const vehicleId = randomUUID();
      const vehicle = makeVehicle(ownerId);
      const existingPromotion = new Promotion(
        vehicleId,
        new PromotionDays(7, 70000),
        clock.now(),
        'credit_card',
        'active',
        clock.now(),
        'txn-old',
      );

      vehicleRepoMock.findById.mockResolvedValue(vehicle);
      promotionRepoMock.findByVehicleId.mockResolvedValue(existingPromotion);

      await expect(
        service.promoteVehicle(ownerId, vehicleId, {
          durationDays: 7,
          startDate: clock.now().toISOString(),
          paymentMethod: 'credit_card',
        }),
      ).rejects.toThrow(VehicleAlreadyPromoted);

      expect(promotionRepoMock.save).not.toHaveBeenCalled();
    });

    it('permite promover si la promoción anterior expiró', async () => {
      const ownerId = randomUUID();
      const vehicleId = randomUUID();
      const vehicle = makeVehicle(ownerId);
      const expiredPromotion = new Promotion(
        vehicleId,
        new PromotionDays(7, 70000),
        new Date('2024-05-20T10:00:00Z'),
        'credit_card',
        'active',
        new Date('2024-05-20T10:00:00Z'),
        'txn-old',
      );

      vehicleRepoMock.findById.mockResolvedValue(vehicle);
      promotionRepoMock.findByVehicleId.mockResolvedValue(expiredPromotion);
      promotionRepoMock.findAllDurations.mockResolvedValue([makePromotionDuration(7, 70000)]);
      paymentGatewayMock.processPayment.mockResolvedValue({
        success: true,
        transactionId: 'txn-new',
      });
      promotionRepoMock.save.mockResolvedValue(
        new Promotion(
          vehicleId,
          new PromotionDays(7, 70000),
          clock.now(),
          'credit_card',
          'active',
          clock.now(),
          'txn-new',
        ),
      );

      const result = await service.promoteVehicle(ownerId, vehicleId, {
        durationDays: 7,
        startDate: clock.now().toISOString(),
        paymentMethod: 'credit_card',
      });

      expect(result.status).toBe('active');
      expect(promotionRepoMock.save).toHaveBeenCalled();
    });

    it('lanza VehicleAlreadyPromoted si save falla por duplicado', async () => {
      const ownerId = randomUUID();
      const vehicleId = randomUUID();
      const vehicle = makeVehicle(ownerId);

      vehicleRepoMock.findById.mockResolvedValue(vehicle);
      promotionRepoMock.findByVehicleId.mockResolvedValue(null);
      promotionRepoMock.findAllDurations.mockResolvedValue([makePromotionDuration(7, 70000)]);
      paymentGatewayMock.processPayment.mockResolvedValue({
        success: true,
        transactionId: 'txn-123',
      });
      promotionRepoMock.save.mockRejectedValue(new Error('Duplicate key'));

      await expect(
        service.promoteVehicle(ownerId, vehicleId, {
          durationDays: 7,
          startDate: clock.now().toISOString(),
          paymentMethod: 'credit_card',
        }),
      ).rejects.toThrow(VehicleAlreadyPromoted);
    });

    it('lanza Error si la duración no es válida', async () => {
      const ownerId = randomUUID();
      const vehicleId = randomUUID();
      const vehicle = makeVehicle(ownerId);

      vehicleRepoMock.findById.mockResolvedValue(vehicle);
      promotionRepoMock.findByVehicleId.mockResolvedValue(null);
      promotionRepoMock.findAllDurations.mockResolvedValue([makePromotionDuration(7, 70000)]);

      await expect(
        service.promoteVehicle(ownerId, vehicleId, {
          durationDays: 999,
          startDate: clock.now().toISOString(),
          paymentMethod: 'credit_card',
        }),
      ).rejects.toThrow('Invalid duration: 999');

      expect(promotionRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('getVehiclePromotion', () => {
    it('retorna active=false si no hay promoción', async () => {
      const vehicleId = randomUUID();

      promotionRepoMock.findByVehicleId.mockResolvedValue(null);

      const result = await service.getVehiclePromotion(vehicleId);

      expect(result.active).toBe(false);
      expect(result.promotion).toBeNull();
      expect(promotionRepoMock.findByVehicleId).toHaveBeenCalledWith(vehicleId);
    });

    it('retorna active=false si la promoción expiró', async () => {
      const vehicleId = randomUUID();
      const expiredPromotion = new Promotion(
        vehicleId,
        new PromotionDays(7, 70000),
        new Date('2024-05-20T10:00:00Z'),
        'credit_card',
        'active',
        new Date('2024-05-20T10:00:00Z'),
        'txn-123',
      );

      promotionRepoMock.findByVehicleId.mockResolvedValue(expiredPromotion);

      const result = await service.getVehiclePromotion(vehicleId);

      expect(result.active).toBe(false);
      expect(result.promotion).toBeNull();
    });

    it('retorna la promoción activa cuando existe y no expiró', async () => {
      const vehicleId = randomUUID();
      const now = clock.now();
      const activePromotion = new Promotion(
        vehicleId,
        new PromotionDays(7, 70000),
        now,
        'credit_card',
        'active',
        now,
        'txn-123',
      );

      promotionRepoMock.findByVehicleId.mockResolvedValue(activePromotion);

      const result = await service.getVehiclePromotion(vehicleId);

      expect(result.active).toBe(true);
      expect(result.promotion).not.toBeNull();
      expect(result.promotion?.status).toBe('active');
      expect(result.promotion?.durationDays).toBe(7);
      expect(result.promotion?.totalCents).toBe(70000);
    });

    it('retorna la promoción pending_approval cuando existe', async () => {
      const vehicleId = randomUUID();
      const now = clock.now();
      const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const pendingPromotion = new Promotion(
        vehicleId,
        new PromotionDays(7, 70000),
        now,
        'bank_transfer',
        'pending_approval',
        null,
        null,
        'transfer-code-123',
        'alias.test',
        expiresAt,
      );

      promotionRepoMock.findByVehicleId.mockResolvedValue(pendingPromotion);

      const result = await service.getVehiclePromotion(vehicleId);

      expect(result.active).toBe(true);
      expect(result.promotion).not.toBeNull();
      expect(result.promotion?.status).toBe('pending_approval');
      expect((result.promotion as any).transferCode).toBe('transfer-code-123');
      expect((result.promotion as any).transferAlias).toBe('alias.test');
    });
  });

  describe('expireOverdue', () => {
    it('expira las promociones vencidas y retorna la cantidad', async () => {
      const vehicleId1 = randomUUID();
      const vehicleId2 = randomUUID();

      const expiredPromotion = new Promotion(
        vehicleId1,
        new PromotionDays(7, 70000),
        new Date('2024-05-20T10:00:00Z'),
        'credit_card',
        'active',
        new Date('2024-05-20T10:00:00Z'),
        'txn-old',
      );

      const activePromotion = new Promotion(
        vehicleId2,
        new PromotionDays(30, 250000),
        clock.now(),
        'credit_card',
        'active',
        clock.now(),
        'txn-new',
      );

      promotionRepoMock.findAllActive.mockResolvedValue([expiredPromotion, activePromotion]);
      promotionRepoMock.delete.mockResolvedValue(undefined);

      const count = await service.expireOverdue();

      expect(count).toBe(1);
      expect(promotionRepoMock.delete).toHaveBeenCalledTimes(1);
      expect(promotionRepoMock.delete).toHaveBeenCalledWith(vehicleId1);
    });

    it('retorna 0 si no hay promociones vencidas', async () => {
      const vehicleId = randomUUID();
      const activePromotion = new Promotion(
        vehicleId,
        new PromotionDays(30, 250000),
        clock.now(),
        'credit_card',
        'active',
        clock.now(),
        'txn-123',
      );

      promotionRepoMock.findAllActive.mockResolvedValue([activePromotion]);

      const count = await service.expireOverdue();

      expect(count).toBe(0);
      expect(promotionRepoMock.delete).not.toHaveBeenCalled();
    });

    it('retorna 0 si no hay promociones activas', async () => {
      promotionRepoMock.findAllActive.mockResolvedValue([]);

      const count = await service.expireOverdue();

      expect(count).toBe(0);
      expect(promotionRepoMock.delete).not.toHaveBeenCalled();
    });

    it('expira múltiples promociones vencidas', async () => {
      const vehicleIds = [randomUUID(), randomUUID(), randomUUID()];

      const expiredPromotions = vehicleIds.map(
        (vehicleId) =>
          new Promotion(
            vehicleId,
            new PromotionDays(7, 70000),
            new Date('2024-05-20T10:00:00Z'),
            'credit_card',
            'active',
            new Date('2024-05-20T10:00:00Z'),
            'txn-old',
          ),
      );

      promotionRepoMock.findAllActive.mockResolvedValue(expiredPromotions);
      promotionRepoMock.delete.mockResolvedValue(undefined);

      const count = await service.expireOverdue();

      expect(count).toBe(3);
      expect(promotionRepoMock.delete).toHaveBeenCalledTimes(3);
      vehicleIds.forEach((vehicleId) => {
        expect(promotionRepoMock.delete).toHaveBeenCalledWith(vehicleId);
      });
    });
  });
});
