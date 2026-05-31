import { randomUUID } from 'crypto';
import { MessagingService } from '@/application/messaging.service';
import { Message } from '@/domain/entities/message.entity';
import { ChatNotAllowedException } from '@/domain/exceptions/messaging.exception';
import {
  ReservationForbiddenException,
  ReservationNotFoundException,
} from '@/domain/exceptions/reservation.exception';
import type { MessageRepository } from '@/domain/repositories/message.repository';
import type { ReservationRepository } from '@/domain/repositories/reservation.repository';
import type { NotificationProvider } from '@/domain/providers/notification.provider';
import { Reservation } from '@/domain/entities/reservation.entity';

const conductorId = randomUUID();
const rentadorId = randomUUID();
const reservationId = randomUUID();
const vehicleId = randomUUID();
const outsiderId = randomUUID();

function makeReservation(
  status: 'confirmed' | 'in_progress' | 'pending_payment' | 'completed' = 'confirmed',
): Reservation {
  const now = new Date();
  const start = new Date(now.getTime() + 1000 * 60 * 60 * 24);
  const end = new Date(now.getTime() + 1000 * 60 * 60 * 48);
  return new Reservation({
    id: reservationId,
    vehicleId,
    conductorId,
    rentadorId,
    status,
    startAt: start,
    endAt: end,
    holdExpiresAt: null,
    totalCents: 10000,
    currency: 'ARS',
    contractAcceptedAt: new Date(),
    paidAt: status === 'confirmed' || status === 'in_progress' || status === 'completed' ? new Date() : null,
    voucherToken: status === 'confirmed' || status === 'in_progress' || status === 'completed' ? randomUUID() : null,
  });
}

function makeMessage(overrides?: Partial<{ reservationId: string; senderId: string; body: string }>): Message {
  return new Message({
    reservationId: overrides?.reservationId ?? reservationId,
    senderId: overrides?.senderId ?? conductorId,
    body: overrides?.body ?? 'Hola, ¿a qué hora llego?',
  });
}

describe('MessagingService', () => {
  let service: MessagingService;
  let messageRepoMock: jest.Mocked<MessageRepository>;
  let reservationRepoMock: jest.Mocked<ReservationRepository>;
  let notificationProviderMock: jest.Mocked<NotificationProvider>;

  beforeEach(() => {
    messageRepoMock = {
      save: jest.fn(),
      findByReservation: jest.fn(),
    };
    reservationRepoMock = {
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByVoucherToken: jest.fn(),
      findByReturnQrToken: jest.fn(),
      findOverlapping: jest.fn(),
      findExpiredHolds: jest.fn(),
      findApprovalExpiredBefore: jest.fn(),
      findActiveByVehicleId: jest.fn(),
      findExpiredTransfers: jest.fn(),
      findOverdueBalances: jest.fn().mockResolvedValue([]),
      findBalanceReminderCandidates: jest.fn().mockResolvedValue([]),
      findOverlappingPendingApproval: jest.fn(),
      approveWithCascade: jest.fn(),
      hasActiveReservations: jest.fn(),
      findByUser: jest.fn(),
      findChain: jest.fn().mockResolvedValue([]),
      findChainTipFor: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue(undefined),
    };
    notificationProviderMock = {
      notify: jest.fn().mockResolvedValue(undefined),
    };
    service = new MessagingService(
      messageRepoMock,
      reservationRepoMock,
      notificationProviderMock,
    );
  });

  // ─── sendMessage ─────────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('guarda el mensaje y retorna SendMessageResponse cuando reserva está en confirmed', async () => {
      const reservation = makeReservation('confirmed');
      reservationRepoMock.findById.mockResolvedValue(reservation);
      const saved = makeMessage({ senderId: conductorId });
      messageRepoMock.save.mockResolvedValue(saved);

      const result = await service.sendMessage(conductorId, reservationId, {
        body: 'Hola',
      });

      expect(messageRepoMock.save).toHaveBeenCalledWith(expect.any(Message));
      expect(result.senderId).toBe(conductorId);
      expect(result.reservationId).toBe(reservationId);
      expect(typeof result.sentAt).toBe('string');
    });

    it('guarda el mensaje cuando reserva está en in_progress', async () => {
      const reservation = makeReservation('in_progress');
      reservationRepoMock.findById.mockResolvedValue(reservation);
      messageRepoMock.save.mockResolvedValue(makeMessage({ senderId: rentadorId }));

      await expect(
        service.sendMessage(rentadorId, reservationId, { body: 'Todo bien' }),
      ).resolves.toBeDefined();
    });

    it('lanza ChatNotAllowedException cuando reserva está en pending_payment', async () => {
      reservationRepoMock.findById.mockResolvedValue(makeReservation('pending_payment'));

      await expect(
        service.sendMessage(conductorId, reservationId, { body: 'Hola' }),
      ).rejects.toThrow(ChatNotAllowedException);
      expect(messageRepoMock.save).not.toHaveBeenCalled();
    });

    it('lanza ChatNotAllowedException cuando reserva está en completed', async () => {
      reservationRepoMock.findById.mockResolvedValue(makeReservation('completed'));

      await expect(
        service.sendMessage(conductorId, reservationId, { body: 'Hola' }),
      ).rejects.toThrow(ChatNotAllowedException);
    });

    it('lanza ReservationForbiddenException cuando el caller no pertenece a la reserva', async () => {
      reservationRepoMock.findById.mockResolvedValue(makeReservation('confirmed'));

      await expect(
        service.sendMessage(outsiderId, reservationId, { body: 'Hola' }),
      ).rejects.toThrow(ReservationForbiddenException);
      expect(messageRepoMock.save).not.toHaveBeenCalled();
    });

    it('lanza ReservationNotFoundException cuando la reserva no existe', async () => {
      reservationRepoMock.findById.mockResolvedValue(null);

      await expect(
        service.sendMessage(conductorId, reservationId, { body: 'Hola' }),
      ).rejects.toThrow(ReservationNotFoundException);
    });

    it('notifica al rentador cuando envía el conductor', async () => {
      const reservation = makeReservation('confirmed');
      reservationRepoMock.findById.mockResolvedValue(reservation);
      messageRepoMock.save.mockResolvedValue(makeMessage({ senderId: conductorId }));

      await service.sendMessage(conductorId, reservationId, { body: 'Hola' });

      expect(notificationProviderMock.notify).toHaveBeenCalledWith(
        rentadorId,
        'Nuevo mensaje',
        expect.any(String),
        expect.objectContaining({ url: expect.any(String) }),
      );
    });

    it('notifica al conductor cuando envía el rentador', async () => {
      const reservation = makeReservation('confirmed');
      reservationRepoMock.findById.mockResolvedValue(reservation);
      messageRepoMock.save.mockResolvedValue(makeMessage({ senderId: rentadorId }));

      await service.sendMessage(rentadorId, reservationId, { body: 'Buenas' });

      expect(notificationProviderMock.notify).toHaveBeenCalledWith(
        conductorId,
        'Nuevo mensaje',
        expect.any(String),
        expect.objectContaining({ url: expect.any(String) }),
      );
    });
  });

  // ─── listMessages ─────────────────────────────────────────────────────────────

  describe('listMessages', () => {
    it('retorna la lista de mensajes de la reserva', async () => {
      const reservation = makeReservation('confirmed');
      reservationRepoMock.findById.mockResolvedValue(reservation);
      const msg = makeMessage();
      messageRepoMock.findByReservation.mockResolvedValue([msg]);

      const result = await service.listMessages(conductorId, reservationId);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.senderId).toBe(conductorId);
    });

    it('retorna lista vacía cuando no hay mensajes', async () => {
      reservationRepoMock.findById.mockResolvedValue(makeReservation('confirmed'));
      messageRepoMock.findByReservation.mockResolvedValue([]);

      const result = await service.listMessages(conductorId, reservationId);

      expect(result.items).toHaveLength(0);
    });

    it('pasa el parámetro after al repository', async () => {
      reservationRepoMock.findById.mockResolvedValue(makeReservation('in_progress'));
      messageRepoMock.findByReservation.mockResolvedValue([]);
      const after = new Date('2026-01-01T10:00:00Z');

      await service.listMessages(conductorId, reservationId, after);

      expect(messageRepoMock.findByReservation).toHaveBeenCalledWith(
        reservationId,
        after,
      );
    });

    it('lanza ChatNotAllowedException si la reserva no está en estado activo', async () => {
      reservationRepoMock.findById.mockResolvedValue(makeReservation('pending_payment'));

      await expect(
        service.listMessages(conductorId, reservationId),
      ).rejects.toThrow(ChatNotAllowedException);
    });

    it('lanza ReservationForbiddenException si el caller no pertenece a la reserva', async () => {
      reservationRepoMock.findById.mockResolvedValue(makeReservation('confirmed'));

      await expect(
        service.listMessages(outsiderId, reservationId),
      ).rejects.toThrow(ReservationForbiddenException);
    });
  });
});
