import { randomUUID } from 'node:crypto';

export interface SearchLogProps {
  id?: string;
  sessionId: string;
  conductorId: string | null;
  h3Cell: string;
  filters: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Registro de una búsqueda de vehículos. Alimenta la señal de demanda zonal
 * que consume el motor de pricing dinámico y el admin panel. Se persiste con
 * debounce por sesión para capturar intención sin loguear ruido de filtros.
 */
export class SearchLog {
  private readonly id: string;
  private readonly sessionId: string;
  private readonly conductorId: string | null;
  private readonly h3Cell: string;
  private readonly filters: Record<string, unknown>;
  private readonly createdAt: Date;

  constructor(props: SearchLogProps) {
    this.id = props.id ?? randomUUID();
    this.sessionId = props.sessionId;
    this.conductorId = props.conductorId;
    this.h3Cell = props.h3Cell;
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
  public getFilters(): Record<string, unknown> {
    return { ...this.filters };
  }
  public getCreatedAt(): Date {
    return this.createdAt;
  }
}
