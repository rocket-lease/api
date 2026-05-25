import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import {
  PAYMENT_GATEWAY_PROVIDER,
  type PaymentGatewayProvider,
} from '@/domain/providers/payment-gateway.provider';
import {
  PROMOTION_REPOSITORY,
  type PromotionRepository,
} from '@/domain/repositories/promotion.repository';
import { VEHICLE_REPOSITORY, type VehicleRepository } from '@/domain/repositories/vehicle.repository';
import { Promotion } from '@/domain/entities/promotion/promotion.entity';
import { PromotionDays } from '@/domain/entities/promotion/promotion.days.entity';
import { VehicleAlreadyPromoted } from '@/domain/exceptions/promotion.exception';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import {
  PromotionDurationsResponseSchema,
  PromoteVehicleResponseSchema,
  GetPromotionResponseSchema,
  type PromoteVehicleRequest,
  type PromotionDurationsResponse,
  type PromoteVehicleResponse,
  type GetPromotionResponse,
} from '@rocket-lease/contracts';

@Injectable()
export class PromotionService {
  constructor(
    @Inject(PROMOTION_REPOSITORY)
    private readonly promotionRepository: PromotionRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(PAYMENT_GATEWAY_PROVIDER)
    private readonly paymentGateway: PaymentGatewayProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async getDurations(): Promise<PromotionDurationsResponse> {
    const durations = await this.promotionRepository.findAllDurations();
    return PromotionDurationsResponseSchema.parse(durations);
  }

  async promoteVehicle(
    ownerId: string,
    vehicleId: string,
    request: PromoteVehicleRequest,
  ): Promise<PromoteVehicleResponse> {
    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle) throw new EntityNotFoundException('vehicle', vehicleId);
    if (vehicle.getOwnerId() !== ownerId) {
      throw new EntityNotFoundException('vehicle', vehicleId);
    }

    const existing = await this.promotionRepository.findByVehicleId(vehicleId);
    if (existing && !existing.isExpired(this.clock.now())) {
      throw new VehicleAlreadyPromoted();
    }

    const durations = await this.promotionRepository.findAllDurations();

    const duration = durations.find((d) => d.days === request.durationDays);
    if (!duration) throw new Error(`Invalid duration: ${request.durationDays}`);

    const promotionDays = new PromotionDays(duration.days, duration.valueInCents);
    const now = this.clock.now();

    if (request.paymentMethod === 'bank_transfer') {
      const { code: transferCode, alias: transferAlias } =
        await this.paymentGateway.generateTransferCode();
      const transferExpiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const promotion = new Promotion(
        vehicleId,
        promotionDays,
        now,
        request.paymentMethod,
        'pending_approval',
        null, null,
        transferCode, transferAlias, transferExpiresAt,
      );

      try {
        await this.promotionRepository.save(promotion);
      } catch {
        throw new VehicleAlreadyPromoted();
      }

      this.autoConfirmTransfer(vehicleId);

      return PromoteVehicleResponseSchema.parse({
        vehicleId: promotion.vehicleId,
        totalCents: promotion.totalCents,
        startDate: promotion.startDate.toISOString(),
        status: 'pending_approval',
        transferCode,
        transferAlias,
        transferExpiresAt: transferExpiresAt.toISOString(),
      });
    }

    const result = await this.paymentGateway.processPayment(
      promotionDays.getTotalCents(),
      'ARS',
      request.paymentMethod,
    );

    const promotion = new Promotion(
      vehicleId,
      promotionDays,
      now,
      request.paymentMethod,
      'active',
      now,
      result.transactionId,
    );

    try {
      await this.promotionRepository.save(promotion);
    } catch {
      throw new VehicleAlreadyPromoted();
    }

    return PromoteVehicleResponseSchema.parse({
      vehicleId: promotion.vehicleId,
      totalCents: promotion.totalCents,
      startDate: promotion.startDate.toISOString(),
      status: 'active',
      paidAt: promotion.paidAt!.toISOString(),
      transactionId: promotion.transactionId!,
    });
  }

  private autoConfirmTransfer(vehicleId: string): void {
    setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const promotion = await this.promotionRepository.findByVehicleId(vehicleId);
          if (!promotion) return;
          if (promotion.status !== 'pending_approval') return;
          if (promotion.transferExpiresAt && this.clock.now() > promotion.transferExpiresAt) return;
          promotion.confirmPayment(this.clock.now(), `txn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
          await this.promotionRepository.save(promotion);
        } catch {
          // auto-confirm falló silenciosamente
        }
      })();
    }, 5000);
  }

  async getVehiclePromotion(vehicleId: string): Promise<GetPromotionResponse> {
    const promotion = await this.promotionRepository.findByVehicleId(vehicleId);
    if (!promotion || promotion.isExpired(this.clock.now())) {
      return GetPromotionResponseSchema.parse({ active: false, promotion: null });
    }
    const endsAt = new Date(promotion.startDate.getTime() + promotion.durationDays * 24 * 60 * 60 * 1000);
    if (promotion.status === 'active') {
      return GetPromotionResponseSchema.parse({
        active: true,
        promotion: {
          status: 'active',
          startDate: promotion.startDate.toISOString(),
          endsAt: endsAt.toISOString(),
          durationDays: promotion.durationDays,
          totalCents: promotion.totalCents,
          paidAt: promotion.paidAt!.toISOString(),
          transactionId: promotion.transactionId!,
        },
      });
    }
    return GetPromotionResponseSchema.parse({
      active: true,
      promotion: {
        status: 'pending_approval',
        startDate: promotion.startDate.toISOString(),
        endsAt: endsAt.toISOString(),
        durationDays: promotion.durationDays,
        totalCents: promotion.totalCents,
        transferCode: promotion.transferCode!,
        transferAlias: promotion.transferAlias!,
        transferExpiresAt: promotion.transferExpiresAt!.toISOString(),
      },
    });
  }

  async expireOverdue(): Promise<number> {
    const active = await this.promotionRepository.findAllActive();
    let count = 0;
    const now = this.clock.now();
    for (const promotion of active) {
      if (promotion.isExpired(now)) {
        await this.promotionRepository.delete(promotion.vehicleId);
        count++;
      }
    }
    return count;
  }
}
