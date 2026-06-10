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
        locationId: log.getLocationId(),
        weight: log.getWeight(),
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
      locationId: row.locationId,
      weight: row.weight,
      signal: row.signal as SearchSignal,
      filters: row.filters as SearchLogFilters,
      createdAt: row.createdAt,
    });
  }

  public async countByHexSince(h3Cell: string, since: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: unknown }>>`
      SELECT COALESCE(SUM(weighted.weight), 0) AS count
      FROM (
        SELECT sl.weight
        FROM search_logs sl
        WHERE sl.h3_cell = ${h3Cell}
          AND sl.created_at >= ${since}

        UNION ALL

        SELECT sl.weight * lhc.weight AS weight
        FROM search_logs sl
        JOIN location_h3_cells lhc ON lhc.location_id = sl.location_id
        WHERE lhc.h3_cell = ${h3Cell}
          AND sl.created_at >= ${since}
      ) weighted
    `;
    return Number(rows[0]?.count ?? 0);
  }

  public async countSignalsInHexSince(
    h3Cell: string,
    since: Date,
  ): Promise<Record<SearchSignal, number>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ signal: string; count: unknown }>
    >`
      SELECT weighted.signal, COALESCE(SUM(weighted.weight), 0) AS count
      FROM (
        SELECT sl.signal, sl.weight
        FROM search_logs sl
        WHERE sl.h3_cell = ${h3Cell}
          AND sl.created_at >= ${since}

        UNION ALL

        SELECT sl.signal, sl.weight * lhc.weight AS weight
        FROM search_logs sl
        JOIN location_h3_cells lhc ON lhc.location_id = sl.location_id
        WHERE lhc.h3_cell = ${h3Cell}
          AND sl.created_at >= ${since}
      ) weighted
      GROUP BY weighted.signal
    `;
    const counts: Record<SearchSignal, number> = {
      search: 0,
      vehicleView: 0,
      quote: 0,
      reservation: 0,
    };
    for (const row of rows) {
      counts[row.signal as SearchSignal] = Number(row.count);
    }
    return counts;
  }

  public async aggregateByH3Since(
    since: Date,
  ): Promise<SearchLogZoneAggregate[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ h3Cell: string; searches: unknown }>
    >`
      SELECT weighted.h3_cell AS "h3Cell", COALESCE(SUM(weighted.weight), 0) AS searches
      FROM (
        SELECT sl.h3_cell, sl.weight
        FROM search_logs sl
        WHERE sl.h3_cell IS NOT NULL
          AND sl.created_at >= ${since}
          AND sl.signal = 'search'

        UNION ALL

        SELECT lhc.h3_cell, sl.weight * lhc.weight AS weight
        FROM search_logs sl
        JOIN location_h3_cells lhc ON lhc.location_id = sl.location_id
        WHERE sl.created_at >= ${since}
          AND sl.signal = 'search'
      ) weighted
      GROUP BY weighted.h3_cell
    `;
    return rows.map((row) => ({
      h3Cell: row.h3Cell,
      searches: Number(row.searches),
      vehicleSampleIds: [],
    }));
  }

  public async aggregateByH3AndSignalSince(
    since: Date,
  ): Promise<SearchLogZoneSignalAggregate[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ h3Cell: string; signal: string; count: unknown }>
    >`
      SELECT
        weighted.h3_cell AS "h3Cell",
        weighted.signal,
        COALESCE(SUM(weighted.weight), 0) AS count
      FROM (
        SELECT sl.h3_cell, sl.signal, sl.weight
        FROM search_logs sl
        WHERE sl.h3_cell IS NOT NULL
          AND sl.created_at >= ${since}

        UNION ALL

        SELECT lhc.h3_cell, sl.signal, sl.weight * lhc.weight AS weight
        FROM search_logs sl
        JOIN location_h3_cells lhc ON lhc.location_id = sl.location_id
        WHERE sl.created_at >= ${since}
      ) weighted
      GROUP BY weighted.h3_cell, weighted.signal
    `;
    return rows.map((row) => ({
      h3Cell: row.h3Cell,
      signal: row.signal as SearchSignal,
      count: Number(row.count),
    }));
  }

  public async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.searchLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}
