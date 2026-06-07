import {
  SearchLog,
  type SearchSignal,
} from '../entities/search-log.entity';

export interface SearchLogZoneAggregate {
  h3Cell: string;
  searches: number;
  vehicleSampleIds: string[];
}

export interface SearchLogZoneSignalAggregate {
  h3Cell: string;
  signal: SearchSignal;
  count: number;
}

export interface SearchLogRepository {
  /**
   * Persiste un nuevo log de búsqueda.
   */
  save(log: SearchLog): Promise<SearchLog>;

  /**
   * Devuelve el log más reciente de la sesión filtrado por `signal`. Se usa
   * para el debounce: ambient searches debounce a 30s, vehicleViews a 5min.
   */
  findLastBySessionAndSignal(
    sessionId: string,
    signal: SearchSignal,
    relatedH3Cell?: string,
  ): Promise<SearchLog | null>;

  /**
   * Cuenta búsquedas en el hex `h3Cell` desde el cutoff `since`.
   */
  countByHexSince(h3Cell: string, since: Date): Promise<number>;

  /**
   * Cuenta señales en un hex desagregadas por tipo. Se usa para alimentar el
   * factor de demanda zonal con pesos por señal.
   */
  countSignalsInHexSince(
    h3Cell: string,
    since: Date,
  ): Promise<Record<SearchSignal, number>>;

  /**
   * Agrega cantidad de búsquedas por hex H3 desde `since`. Cuenta solo
   * `signal='search'` para mantener compatibilidad con la API previa.
   */
  aggregateByH3Since(since: Date): Promise<SearchLogZoneAggregate[]>;

  /**
   * Agrega cantidades por hex H3 desagregadas por señal. La aplicación las
   * pondera al construir la demanda total.
   */
  aggregateByH3AndSignalSince(
    since: Date,
  ): Promise<SearchLogZoneSignalAggregate[]>;

  /**
   * Borra search logs cuyo `created_at < cutoff`. Devuelve la cantidad
   * eliminada (cron de retención).
   */
  deleteOlderThan(cutoff: Date): Promise<number>;
}

export const SEARCH_LOG_REPOSITORY = Symbol('SearchLogRepository');
