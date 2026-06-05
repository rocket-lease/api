import { SearchLog } from '../entities/search-log.entity';

export interface SearchLogZoneAggregate {
  h3Cell: string;
  searches: number;
  vehicleSampleIds: string[];
}

export interface SearchLogRepository {
  /**
   * Persiste un nuevo log de búsqueda.
   */
  save(log: SearchLog): Promise<SearchLog>;

  /**
   * Devuelve el log más reciente de la sesión, o `null` si la sesión nunca
   * logueó. Se usa para el debounce de 30s.
   */
  findLastBySession(sessionId: string): Promise<SearchLog | null>;

  /**
   * Cuenta búsquedas en el hex `h3Cell` desde el cutoff `since`.
   */
  countByHexSince(h3Cell: string, since: Date): Promise<number>;

  /**
   * Agrega cantidad de búsquedas por hex H3 desde `since`. Se usa para el
   * admin panel y para el factor de demanda zonal.
   */
  aggregateByH3Since(since: Date): Promise<SearchLogZoneAggregate[]>;

  /**
   * Borra search logs cuyo `created_at < cutoff`. Devuelve la cantidad
   * eliminada (cron de retención).
   */
  deleteOlderThan(cutoff: Date): Promise<number>;
}

export const SEARCH_LOG_REPOSITORY = Symbol('SearchLogRepository');
