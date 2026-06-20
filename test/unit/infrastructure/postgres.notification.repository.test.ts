import { randomUUID } from 'crypto';
import { PostgresNotificationRepository } from '@/infrastructure/repository/postgres.notification.repository';
import type { PrismaService } from '@/infrastructure/database/prisma.service';

const userId = randomUUID();

function makePrisma() {
  return {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as unknown as PrismaService;
}

describe('PostgresNotificationRepository', () => {
  it('creates a notification and maps the row', async () => {
    const prisma = makePrisma();
    const row = {
      id: randomUUID(),
      userId,
      title: 'Aviso',
      body: 'Cuerpo',
      url: '/reservas/x',
      imageUrl: null,
      readAt: null,
      createdAt: new Date(),
    };
    (prisma.notification.create as jest.Mock).mockResolvedValue(row);
    const repo = new PostgresNotificationRepository(prisma);

    const result = await repo.save({
      userId,
      title: 'Aviso',
      body: 'Cuerpo',
      url: '/reservas/x',
      imageUrl: null,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId, title: 'Aviso', body: 'Cuerpo', url: '/reservas/x', imageUrl: null },
    });
    expect(result).toEqual(row);
  });

  it('lists the most recent notifications first, limited', async () => {
    const prisma = makePrisma();
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    const repo = new PostgresNotificationRepository(prisma);

    await repo.findByUserId(userId, 50);

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('counts only unread notifications', async () => {
    const prisma = makePrisma();
    (prisma.notification.count as jest.Mock).mockResolvedValue(3);
    const repo = new PostgresNotificationRepository(prisma);

    expect(await repo.countUnread(userId)).toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId, readAt: null } });
  });

  it('marks a single unread notification as read, scoped to the owner', async () => {
    const prisma = makePrisma();
    (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    const repo = new PostgresNotificationRepository(prisma);
    const id = randomUUID();

    await repo.markRead(userId, id);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id, userId, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it('marks every unread notification of the user as read', async () => {
    const prisma = makePrisma();
    (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 5 });
    const repo = new PostgresNotificationRepository(prisma);

    await repo.markAllRead(userId);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it('deletes a notification scoped to the owner', async () => {
    const prisma = makePrisma();
    (prisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    const repo = new PostgresNotificationRepository(prisma);
    const id = randomUUID();

    await repo.delete(userId, id);

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id, userId },
    });
  });
});
