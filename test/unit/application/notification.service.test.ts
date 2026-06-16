import { randomUUID } from 'crypto';
import { NotificationService } from '@/application/notification.service';
import type {
  NotificationData,
  NotificationRepository,
} from '@/domain/repositories/notification.repository';

const userId = randomUUID();

function makeRow(overrides?: Partial<NotificationData>): NotificationData {
  return {
    id: randomUUID(),
    userId,
    title: 'Reserva confirmada',
    body: 'Tu reserva del Toyota Corolla está confirmada.',
    url: '/reservas/abc',
    readAt: null,
    createdAt: new Date('2026-06-15T12:00:00.000Z'),
    ...overrides,
  };
}

describe('NotificationService', () => {
  let service: NotificationService;
  let repo: jest.Mocked<NotificationRepository>;

  beforeEach(() => {
    repo = {
      save: jest.fn(),
      findByUserId: jest.fn(),
      countUnread: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };
    service = new NotificationService(repo);
  });

  it('lists notifications as ISO DTOs with the unread count', async () => {
    const row = makeRow({ readAt: new Date('2026-06-15T13:00:00.000Z') });
    repo.findByUserId.mockResolvedValue([row]);
    repo.countUnread.mockResolvedValue(0);

    const result = await service.list(userId);

    expect(repo.findByUserId).toHaveBeenCalledWith(userId, 50);
    expect(result.unreadCount).toBe(0);
    expect(result.notifications).toEqual([
      {
        id: row.id,
        title: row.title,
        body: row.body,
        url: row.url,
        readAt: '2026-06-15T13:00:00.000Z',
        createdAt: '2026-06-15T12:00:00.000Z',
      },
    ]);
  });

  it('returns the unread count', async () => {
    repo.countUnread.mockResolvedValue(4);
    expect(await service.unreadCount(userId)).toEqual({ unreadCount: 4 });
  });

  it('marks one as read and returns the recomputed unread count', async () => {
    repo.countUnread.mockResolvedValue(2);
    const id = randomUUID();

    const result = await service.markRead(userId, id);

    expect(repo.markRead).toHaveBeenCalledWith(userId, id);
    expect(result).toEqual({ unreadCount: 2 });
  });

  it('marks all as read and returns zero without re-querying', async () => {
    const result = await service.markAllRead(userId);

    expect(repo.markAllRead).toHaveBeenCalledWith(userId);
    expect(repo.countUnread).not.toHaveBeenCalled();
    expect(result).toEqual({ unreadCount: 0 });
  });
});
