import { PriceQuote } from '../entities/price-quote.entity';

export interface PriceQuoteAggregatedZone {
  h3Cell: string;
  avgMultiplier: number;
  sampleSize: number;
}

export interface PriceQuoteRepository {
  /**
   * Persiste un nuevo PriceQuote. La entidad se devuelve tal cual; el id ya
   * está asignado al crearla.
   */
  save(quote: PriceQuote): Promise<PriceQuote>;

  /**
   * Recupera un PriceQuote por su token (id). Devuelve `null` si no existe.
   */
  findById(id: string): Promise<PriceQuote | null>;

  /**
   * Devuelve el multiplier promedio por cada hex H3 con quotes en la ventana
   * `[since, now]`. Se usa para colorear el admin map.
   */
  aggregateMultiplierByH3Since(since: Date): Promise<PriceQuoteAggregatedZone[]>;

  /**
   * Borra quotes cuyo `expires_at < cutoff`. Devuelve la cantidad eliminada.
   */
  deleteExpiredBefore(cutoff: Date): Promise<number>;
}

export const PRICE_QUOTE_REPOSITORY = Symbol('PriceQuoteRepository');
