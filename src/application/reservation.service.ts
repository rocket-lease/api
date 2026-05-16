import { Inject, Injectable } from '@nestjs/common';
import {
  type CreateReservationRequest,
  type CreateReservationResponse,
  CreateReservationResponseSchema,
  type ConfirmReservationPaymentRequest,
  type ConfirmReservationPaymentResponse,
  ConfirmReservationPaymentResponseSchema,
  type GetReservationResponse,
  GetReservationResponseSchema,
  type VehicleBusyRangesResponse,
  VehicleBusyRangesResponseSchema,
  type ReservationListItem,
  type ReservationsListRequest,
  type ReservationsListResponse,
  ReservationsListResponseSchema,
} from '@rocket-lease/contracts';
import {
  BLOCKING_STATUSES,
  HOLD_TTL_MS,
  Reservation,
} from '@/domain/entities/reservation.entity';
import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '@/domain/repositories/reservation.repository';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepository,
} from '@/domain/repositories/vehicle.repository';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { EntityNotFoundException } from '@/domain/exceptions/domain.exception';
import {
  ContractNotAcceptedException,
  HoldExpiredException,
  OwnerCannotReserveOwnVehicleException,
  ReservationForbiddenException,
  ReservationNotFoundException,
  VehicleNotAvailableException,
} from '@/domain/exceptions/reservation.exception';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { computeReservationTotalCents } from './helpers/pricing';
import { Vehicle } from '@/domain/entities/vehicle.entity';

@Injectable()
export class ReservationService {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: ReservationRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  public async createReservation(
    conductorId: string,
    dto: CreateReservationRequest,
  ): Promise<CreateReservationResponse> {
    const vehicle = await this.vehicleRepository.findById(dto.vehicleId);
    if (!vehicle) throw new EntityNotFoundException('vehicle', dto.vehicleId);
    if (!vehicle.isEnabled()) {
      throw new VehicleNotAvailableException(dto.vehicleId);
    }
    if (vehicle.isOwnedBy(conductorId)) {
      throw new OwnerCannotReserveOwnVehicleException(dto.vehicleId);
    }
    if (dto.contractAccepted !== true) {
      throw new ContractNotAcceptedException();
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    const now = this.clock.now();

    const overlapping = await this.reservationRepository.findOverlapping(
      vehicle.getId(),
      startAt,
      endAt,
      BLOCKING_STATUSES,
    );
    if (overlapping.length > 0) {
      throw new VehicleNotAvailableException(vehicle.getId());
    }

    const totalCents = computeReservationTotalCents(
      Math.round(vehicle.getBasePrice()),
      startAt,
      endAt,
    );

    const reservation = new Reservation({
      vehicleId: vehicle.getId(),
      conductorId,
      rentadorId: vehicle.getOwnerId(),
      status: 'pending_payment',
      startAt,
      endAt,
      holdExpiresAt: new Date(now.getTime() + HOLD_TTL_MS),
      totalCents,
      currency: 'ARS',
      paymentMethod: null,
      contractAcceptedAt: now,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    });

    let saved: Reservation;
    try {
      saved = await this.reservationRepository.save(reservation);
    } catch (e) {
      if (isExclusionViolation(e)) {
        throw new VehicleNotAvailableException(vehicle.getId());
      }
      throw e;
    }

    return CreateReservationResponseSchema.parse({
      id: saved.getId(),
      status: 'pending_payment',
      holdExpiresAt: saved.getHoldExpiresAt()!.toISOString(),
      totalCents: saved.getTotalCents(),
      currency: 'ARS',
    });
  }

  public async confirmPayment(
    conductorId: string,
    reservationId: string,
    dto: ConfirmReservationPaymentRequest,
  ): Promise<ConfirmReservationPaymentResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (!reservation.isOwnedByConductor(conductorId)) {
      throw new ReservationForbiddenException();
    }

    const now = this.clock.now();
    if (reservation.isHoldExpired(now) || reservation.getStatus() === 'expired') {
      if (reservation.getStatus() === 'pending_payment') {
        reservation.markExpired(now);
        await this.reservationRepository.update(reservation);
      }
      throw new HoldExpiredException(reservationId);
    }

    reservation.confirmPayment(dto.paymentMethod, now);
    const saved = await this.reservationRepository.update(reservation);

    return ConfirmReservationPaymentResponseSchema.parse({
      id: saved.getId(),
      status: 'confirmed',
      paidAt: saved.getPaidAt()!.toISOString(),
    });
  }

  public async getById(
    conductorId: string,
    reservationId: string,
  ): Promise<GetReservationResponse> {
    const reservation =
      await this.reservationRepository.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundException(reservationId);
    if (
      !reservation.isOwnedByConductor(conductorId) &&
      reservation.getRentadorId() !== conductorId
    ) {
      throw new ReservationForbiddenException();
    }
    return this.toDTO(reservation);
  }

  /**
   * Lista reservas desde la perspectiva del usuario autenticado.
   * - role='conductor': reservas que el user creó.
   * - role='owner':     reservas sobre vehículos del user.
   * Hidrata vehicle + conductor + rentador en 3 queries batch (no N+1).
   */
  public async list(
    userId: string,
    dto: ReservationsListRequest,
  ): Promise<ReservationsListResponse> {
    const { items, total } = await this.reservationRepository.findByUser(
      userId,
      dto.role,
      {
        status: dto.status,
        from: dto.from ? new Date(dto.from) : undefined,
        to: dto.to ? new Date(dto.to) : undefined,
        page: dto.page,
        pageSize: dto.pageSize,
      },
    );

    // Batch fetch: 1 query vehicles + 1 query users (conductores ∪ rentadores).
    // Total: 3 queries (1 reservations + 2 batch) sin importar N.
    const vehicleIds = [...new Set(items.map((r) => r.getVehicleId()))];
    const userIds = [
      ...new Set([
        ...items.map((r) => r.getConductorId()),
        ...items.map((r) => r.getRentadorId()),
      ]),
    ];
    const [vehicles, users] = await Promise.all([
      this.vehicleRepository.findByIds(vehicleIds),
      this.userRepository.getProfilesByIds(userIds),
    ]);
    const vehicleById = new Map(vehicles.map((v) => [v.getId(), v]));
    const userById = new Map(users.map((u) => [u.id, u]));

    const dtos = items.map((r) =>
      this.toListItemDTO(
        r,
        vehicleById.get(r.getVehicleId()) ?? null,
        userById.get(r.getConductorId()) ?? null,
        userById.get(r.getRentadorId()) ?? null,
      ),
    );
    return ReservationsListResponseSchema.parse({
      items: dtos,
      page: dto.page,
      pageSize: dto.pageSize,
      total,
    });
  }

  public async getBusyRangesForVehicle(
    vehicleId: string,
  ): Promise<VehicleBusyRangesResponse> {
    const reservations =
      await this.reservationRepository.findActiveByVehicleId(
        vehicleId,
        BLOCKING_STATUSES,
      );
    const items = reservations.map((r) => ({
      startAt: r.getStartAt().toISOString(),
      endAt: r.getEndAt().toISOString(),
    }));
    return VehicleBusyRangesResponseSchema.parse({ items });
  }

  public async expireOverdueHolds(): Promise<number> {
    const now = this.clock.now();
    const expired = await this.reservationRepository.findExpiredHolds(now);
    for (const r of expired) {
      r.markExpired(now);
      await this.reservationRepository.update(r);
    }
    return expired.length;
  }

  public async cancelHoldsForVehicle(vehicleId: string): Promise<number> {
    const now = this.clock.now();
    const pending = await this.reservationRepository.findActiveByVehicleId(
      vehicleId,
      ['pending_payment'],
    );
    for (const r of pending) {
      r.cancelHold(now);
      await this.reservationRepository.update(r);
    }
    return pending.length;
  }

  private async toDTO(r: Reservation): Promise<GetReservationResponse> {
    const vehicle = await this.vehicleRepository.findById(r.getVehicleId());
    const rentadorProfile = await this.userRepository.getProfileById(
      r.getRentadorId(),
    );
    return GetReservationResponseSchema.parse({
      id: r.getId(),
      vehicleId: r.getVehicleId(),
      conductorId: r.getConductorId(),
      rentadorId: r.getRentadorId(),
      status: r.getStatus(),
      startAt: r.getStartAt().toISOString(),
      endAt: r.getEndAt().toISOString(),
      holdExpiresAt: r.getHoldExpiresAt()
        ? r.getHoldExpiresAt()!.toISOString()
        : null,
      totalCents: r.getTotalCents(),
      currency: r.getCurrency(),
      paymentMethod: r.getPaymentMethod(),
      contractAcceptedAt: r.getContractAcceptedAt()
        ? r.getContractAcceptedAt()!.toISOString()
        : null,
      paidAt: r.getPaidAt() ? r.getPaidAt()!.toISOString() : null,
      createdAt: r.getCreatedAt().toISOString(),
      updatedAt: r.getUpdatedAt().toISOString(),
      vehicle: this.vehicleSummary(vehicle, r.getVehicleId()),
      rentador: {
        id: r.getRentadorId(),
        name: rentadorProfile?.name ?? 'Rentador',
        avatarUrl: rentadorProfile?.avatarUrl ?? null,
      },
    });
  }

  private toListItemDTO(
    r: Reservation,
    vehicle: Vehicle | null,
    conductorProfile: { name: string; avatarUrl: string | null } | null,
    rentadorProfile: { name: string; avatarUrl: string | null } | null,
  ): ReservationListItem {
    return {
      id: r.getId(),
      vehicleId: r.getVehicleId(),
      conductorId: r.getConductorId(),
      rentadorId: r.getRentadorId(),
      status: r.getStatus(),
      startAt: r.getStartAt().toISOString(),
      endAt: r.getEndAt().toISOString(),
      holdExpiresAt: r.getHoldExpiresAt()
        ? r.getHoldExpiresAt()!.toISOString()
        : null,
      totalCents: r.getTotalCents(),
      currency: r.getCurrency(),
      paymentMethod: r.getPaymentMethod(),
      paidAt: r.getPaidAt() ? r.getPaidAt()!.toISOString() : null,
      createdAt: r.getCreatedAt().toISOString(),
      updatedAt: r.getUpdatedAt().toISOString(),
      vehicle: this.vehicleSummary(vehicle, r.getVehicleId()),
      conductor: {
        id: r.getConductorId(),
        name: conductorProfile?.name ?? 'Conductor',
        avatarUrl: conductorProfile?.avatarUrl ?? null,
      },
      rentador: {
        id: r.getRentadorId(),
        name: rentadorProfile?.name ?? 'Rentador',
        avatarUrl: rentadorProfile?.avatarUrl ?? null,
      },
    };
  }

  private vehicleSummary(vehicle: Vehicle | null, vehicleId: string) {
    if (!vehicle) {
      return {
        id: vehicleId,
        brand: '—',
        model: '—',
        year: 0,
        photo: null,
      };
    }
    const photos = vehicle.getPhotos();
    return {
      id: vehicle.getId(),
      brand: vehicle.getBrand(),
      model: vehicle.getModel(),
      year: vehicle.getYear(),
      photo: photos.length > 0 ? photos[0] : null,
    };
  }
}

function isExclusionViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const anyE = e as { code?: string; meta?: { code?: string } };
  if (anyE.code === '23P01') return true;
  if (anyE.meta?.code === '23P01') return true;
  const msg = (e as Error).message ?? '';
  return msg.includes('reservations_no_overlap');
}
