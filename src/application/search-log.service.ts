import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SEARCH_LOG_REPOSITORY,
  type SearchLogRepository,
} from '@/domain/repositories/search-log.repository';
import { CLOCK, type Clock } from '@/domain/providers/clock.provider';
import {
  SearchLog,
  type SearchLogFilters,
  type SearchSignal,
} from '@/domain/entities/search-log.entity';
import { latLonToH3 } from '@/application/helpers/h3';
import { GeoLocationService } from './geo-location.service';

/**
 * Ventanas de debounce por señal. Las búsquedas viewport son ambient (señal
 * débil pero frecuente) y se debouncean a 30s para no inflar la tabla. Los
 * vehicleViews son intent signals y aceptan un debounce mayor (5min) por
 * (sesión, vehículo) para evitar duplicados al refrescar o navegar atrás
 * sin perder eventos legítimos.
 */
const DEBOUNCE_SECONDS_BY_SIGNAL: Record<SearchSignal, number> = {
  search: 30,
  vehicleView: 300,
  quote: 0,
  reservation: 0,
};

export interface MaybeLogSearchInput {
  sessionId: string | null | undefined;
  conductorId: string | null;
  latitude: number | null;
  longitude: number | null;
  locationCode?: string | null;
  signal?: SearchSignal;
  filters: SearchLogFilters;
}

export interface LogVehicleViewInput {
  sessionId: string | null | undefined;
  conductorId: string | null;
  vehicleId: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Captura señales de interés zonal persistiendo logs. Cada llamada graba un
 * registro de tipo `signal` (search ambient, vehicleView intent, quote o
 * reservation conversion) y respeta una ventana de debounce por sesión y
 * señal para evitar inflar la tabla con duplicados.
 */
@Injectable()
export class SearchLogService {
  private readonly logger = new Logger(SearchLogService.name);

  constructor(
    @Inject(SEARCH_LOG_REPOSITORY)
    private readonly searchLogRepository: SearchLogRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
    @Inject(GeoLocationService)
    private readonly geoLocationService: GeoLocationService,
  ) {}

  /**
   * Loguea una búsqueda ambient (`signal='search'`). La búsqueda se ancla a
   * una ubicación del catálogo (`locationCode`) o a una celda H3 derivada de
   * coordenadas; son mutuamente excluyentes y, si no hay ninguna de las dos,
   * el evento se descarta: un log sin ancla espacial no puede agregarse por
   * zona. El debounce de 30s distingue el tipo de ancla: repetir el mismo
   * barrio es ruido y se suprime, pero elegir un barrio distinto es intención
   * nueva y se loguea siempre; las búsquedas por coordenadas mantienen el
   * debounce global porque panear el mapa emite un stream de celdas vecinas.
   */
  public async maybeLog(input: MaybeLogSearchInput): Promise<void> {
    if (!input.sessionId) return;
    const location = input.locationCode
      ? await this.geoLocationService.findEnabledByCode(input.locationCode)
      : null;
    const h3Cell = location
      ? null
      : latLonToH3(input.latitude, input.longitude);
    if (!location && !h3Cell) return;
    const signal: SearchSignal = input.signal ?? 'search';
    const now = this.clock.now();
    const debounceWindowSec = DEBOUNCE_SECONDS_BY_SIGNAL[signal];
    if (debounceWindowSec > 0) {
      const last = await this.searchLogRepository.findLastBySessionAndSignal(
        input.sessionId,
        signal,
      );
      if (last) {
        const elapsedSec =
          (now.getTime() - last.getCreatedAt().getTime()) / 1000;
        const repeatsAnchor = location
          ? last.getLocationId() === location.id
          : true;
        if (elapsedSec < debounceWindowSec && repeatsAnchor) return;
      }
    }
    const log = new SearchLog({
      sessionId: input.sessionId,
      conductorId: input.conductorId,
      h3Cell,
      locationId: location?.id ?? null,
      signal,
      filters: {
        ...input.filters,
        locationCode: location?.code ?? input.locationCode ?? undefined,
      },
      createdAt: now,
    });
    await this.searchLogRepository.save(log);
  }

  /**
   * Loguea un vehicleView con el hex del vehículo. Debounce por (sesión,
   * vehículo) para que abrir-cerrar-abrir el mismo auto no cuente dos veces.
   */
  public async logVehicleView(input: LogVehicleViewInput): Promise<void> {
    if (!input.sessionId) return;
    const h3Cell = latLonToH3(input.latitude, input.longitude);
    if (!h3Cell) return;
    const now = this.clock.now();
    const last = await this.searchLogRepository.findLastBySessionAndSignal(
      input.sessionId,
      'vehicleView',
      h3Cell,
    );
    if (last) {
      const elapsedSec =
        (now.getTime() - last.getCreatedAt().getTime()) / 1000;
      if (elapsedSec < DEBOUNCE_SECONDS_BY_SIGNAL.vehicleView) return;
    }
    const log = new SearchLog({
      sessionId: input.sessionId,
      conductorId: input.conductorId,
      h3Cell,
      signal: 'vehicleView',
      filters: { vehicleId: input.vehicleId },
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

  /**
   * Variante fire-and-forget de `logVehicleView`.
   */
  public logVehicleViewAsync(input: LogVehicleViewInput): void {
    this.logVehicleView(input).catch((error) => {
      this.logger.warn(
        `vehicleView log failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }
}
