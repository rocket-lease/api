import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SEARCH_LOG_REPOSITORY,
  type SearchLogRepository,
} from '@/domain/repositories/search-log.repository';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import { SearchLog } from '@/domain/entities/search-log.entity';
import { latLonToH3 } from '@/application/helpers/h3';

const DEBOUNCE_SECONDS = 30;

export interface MaybeLogSearchInput {
  sessionId: string | null | undefined;
  conductorId: string | null;
  latitude: number | null;
  longitude: number | null;
  filters: Record<string, unknown>;
}

/**
 * Captura señales de demanda persistiendo logs de búsqueda. Respeta un
 * debounce de 30 segundos por sesión para evitar inflar la tabla cuando el
 * usuario hace ajustes finos de filtros.
 */
@Injectable()
export class SearchLogService {
  private readonly logger = new Logger(SearchLogService.name);

  constructor(
    @Inject(SEARCH_LOG_REPOSITORY)
    private readonly searchLogRepository: SearchLogRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  /**
   * Loguea la búsqueda si pasaron al menos 30 segundos desde el último log
   * de la sesión y las coordenadas son válidas. Caso contrario es no-op.
   */
  public async maybeLog(input: MaybeLogSearchInput): Promise<void> {
    if (!input.sessionId) return;
    const h3Cell = latLonToH3(input.latitude, input.longitude);
    if (!h3Cell) return;
    const now = this.clock.now();
    const last = await this.searchLogRepository.findLastBySession(
      input.sessionId,
    );
    if (last) {
      const elapsedSec =
        (now.getTime() - last.getCreatedAt().getTime()) / 1000;
      if (elapsedSec < DEBOUNCE_SECONDS) return;
    }
    const log = new SearchLog({
      sessionId: input.sessionId,
      conductorId: input.conductorId,
      h3Cell,
      filters: input.filters,
      createdAt: now,
    });
    await this.searchLogRepository.save(log);
  }

  /**
   * Variante fire-and-forget para llamarse desde controllers sin esperar la
   * promesa: cualquier error se loggea pero no se propaga al handler HTTP.
   */
  public maybeLogAsync(input: MaybeLogSearchInput): void {
    this.maybeLog(input).catch((error) => {
      this.logger.warn(
        `searchLog failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }
}
