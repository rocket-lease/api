import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  SearchLog,
  type SearchLogFilters,
  type SearchSignal,
} from '@/domain/entities/search-log.entity';
import {
  SearchLogRepository,
  type SearchLogZoneAggregate,
  type SearchLogZoneSignalAggregate,
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
        signal: log.getSignal(),
        filters: log.getFilters() as Prisma.InputJsonValue,
        createdAt: log.getCreatedAt(),
      },
    });
    return log;
  }

  public async findLastBySessionAndSignal(
    sessionId: string,
    signal: SearchSignal,
    relatedH3Cell?: string,
  ): Promise<SearchLog | null> {
    const row = await this.prisma.searchLog.findFirst({
      where: {
        sessionId,
        signal,
        ...(relatedH3Cell ? { h3Cell: relatedH3Cell } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return null;
    return new SearchLog({
      id: row.id,
      sessionId: row.sessionId,
      conductorId: row.conductorId,
      h3Cell: row.h3Cell,
      signal: row.signal as SearchSignal,
      filters: row.filters as SearchLogFilters,
      createdAt: row.createdAt,
    });
  }

  public async countByHexSince(h3Cell: string, since: Date): Promise<number> {
    return this.prisma.searchLog.count({
      where: { h3Cell, createdAt: { gte: since } },
    });
  }

  public async countSignalsInHexSince(
    h3Cell: string,
    since: Date,
  ): Promise<Record<SearchSignal, number>> {
    const rows = await this.prisma.searchLog.groupBy({
      by: ['signal'],
      where: { h3Cell, createdAt: { gte: since } },
      _count: { _all: true },
    });
    const counts: Record<SearchSignal, number> = {
      search: 0,
      vehicleView: 0,
      quote: 0,
      reservation: 0,
    };
    for (const row of rows) {
      counts[row.signal as SearchSignal] = row._count._all;
    }
    return counts;
  }

  public async aggregateByH3Since(
    since: Date,
  ): Promise<SearchLogZoneAggregate[]> {
    const rows = await this.prisma.searchLog.groupBy({
      by: ['h3Cell'],
      where: { createdAt: { gte: since }, signal: 'search' },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      h3Cell: row.h3Cell,
      searches: row._count._all,
      vehicleSampleIds: [],
    }));
  }

  public async aggregateByH3AndSignalSince(
    since: Date,
  ): Promise<SearchLogZoneSignalAggregate[]> {
    const rows = await this.prisma.searchLog.groupBy({
      by: ['h3Cell', 'signal'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      h3Cell: row.h3Cell,
      signal: row.signal as SearchSignal,
      count: row._count._all,
    }));
  }

  public async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.searchLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}
