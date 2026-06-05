import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SearchLog } from '@/domain/entities/search-log.entity';
import {
  SearchLogRepository,
  type SearchLogZoneAggregate,
} from '@/domain/repositories/search-log.repository';

@Injectable()
export class PostgresSearchLogRepository implements SearchLogRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async save(log: SearchLog): Promise<SearchLog> {
    await this.prisma.searchLog.create({
      data: {
        id: log.getId(),
        sessionId: log.getSessionId(),
        conductorId: log.getConductorId(),
        h3Cell: log.getH3Cell(),
        filters: log.getFilters() as Prisma.InputJsonValue,
        createdAt: log.getCreatedAt(),
      },
    });
    return log;
  }

  public async findLastBySession(
    sessionId: string,
  ): Promise<SearchLog | null> {
    const row = await this.prisma.searchLog.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return null;
    return new SearchLog({
      id: row.id,
      sessionId: row.sessionId,
      conductorId: row.conductorId,
      h3Cell: row.h3Cell,
      filters: row.filters as Record<string, unknown>,
      createdAt: row.createdAt,
    });
  }

  public async countByHexSince(h3Cell: string, since: Date): Promise<number> {
    return this.prisma.searchLog.count({
      where: { h3Cell, createdAt: { gte: since } },
    });
  }

  public async aggregateByH3Since(
    since: Date,
  ): Promise<SearchLogZoneAggregate[]> {
    const rows = await this.prisma.searchLog.groupBy({
      by: ['h3Cell'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      h3Cell: row.h3Cell,
      searches: row._count._all,
      vehicleSampleIds: [],
    }));
  }

  public async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.searchLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}
