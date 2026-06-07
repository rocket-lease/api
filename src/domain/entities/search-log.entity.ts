import { randomUUID } from 'node:crypto';

export type SearchSignal = 'search' | 'vehicleView' | 'quote' | 'reservation';

export interface SearchLogFilters {
  transmission?: string;
  maxPriceDaily?: number;
  characteristics?: string[];
  isAccessible?: boolean;
  from?: string;
  to?: string;
  vehicleId?: string;
}

export interface SearchLogProps {
  id?: string;
  sessionId: string;
  conductorId: string | null;
  h3Cell: string;
  signal?: SearchSignal;
  filters: SearchLogFilters;
  createdAt: Date;
}

/**
 * Registro de una señal de interés del conductor en una zona H3. Las cuatro
 * variantes (`signal`) representan niveles de intención crecientes y se
 * ponderan al agregar la demanda zonal: ver un mapa es señal débil, mirar
 * un vehículo es media, cotizarlo es fuerte y reservarlo es conversión.
 */
export class SearchLog {
  private readonly id: string;
  private readonly sessionId: string;
  private readonly conductorId: string | null;
  private readonly h3Cell: string;
  private readonly signal: SearchSignal;
  private readonly filters: SearchLogFilters;
  private readonly createdAt: Date;

  constructor(props: SearchLogProps) {
    this.id = props.id ?? randomUUID();
    this.sessionId = props.sessionId;
    this.conductorId = props.conductorId;
    this.h3Cell = props.h3Cell;
    this.signal = props.signal ?? 'search';
    this.filters = props.filters;
    this.createdAt = props.createdAt;
  }

  public getId(): string {
    return this.id;
  }
  public getSessionId(): string {
    return this.sessionId;
  }
  public getConductorId(): string | null {
    return this.conductorId;
  }
  public getH3Cell(): string {
    return this.h3Cell;
  }
  public getSignal(): SearchSignal {
    return this.signal;
  }
  public getFilters(): SearchLogFilters {
    return { ...this.filters };
  }
  public getCreatedAt(): Date {
    return this.createdAt;
  }
}
