/**
 * RecommendationScorer — Domain Service (pure, no NestJS dependencies)
 *
 * Calcula un score de relevancia para cada vehículo disponible basado en
 * el historial de reservas del conductor, sus preferencias guardadas y
 * sus favoritos.
 *
 * El score es determinístico: mismos inputs → mismos outputs.
 * No requiere persistencia propia ni tablas en DB.
 */

export interface ReservationHistoryItem {
  vehicleId: string;
  brand: string;
  transmission: string;
  province: string;
  passengers: number;
  characteristics: string[];
}

export interface UserPreferences {
  transmission?: string;
  accessibility?: string[];
  maxPriceDailyCents?: number;
}

export interface VehicleForScoring {
  id: string;
  brand: string;
  model: string;
  transmission: string;
  province: string;
  city: string;
  passengers: number;
  isAccessible: boolean;
  basePriceCents: number;
  characteristics: string[];
  enabled: boolean;
}

export interface ScoredVehicle {
  vehicle: VehicleForScoring;
  score: number;
  reasons: string[];
}

export interface ScorerInput {
  history: ReservationHistoryItem[];
  preferences: UserPreferences | null;
  favoriteVehicleIds: string[];
  availableVehicles: VehicleForScoring[];
  previouslyRentedVehicleIds: string[];
}

const SCORE_RULES = {
  TRANSMISSION_MATCHES_PREFERENCE: 50,
  BRAND_IN_HISTORY: 30,
  PROVINCE_MATCHES_HISTORY: 20,
  PRICE_WITHIN_PREFERENCE: 15,
  SAME_TRANSMISSION_AS_HISTORY: 25,
  PASSENGERS_MATCHES_HISTORY: 10,
  IS_ACCESSIBLE_MATCHES_PREFERENCE: 20,
  IS_FAVORITE: 35,
  PER_CHARACTERISTIC_MATCH: 5,
  WAS_RENTED_BEFORE: 40,
} as const;

export class RecommendationScorer {
  /**
   * Calcula y ordena vehículos por score de recomendación descendente.
   * Retorna los top N vehículos con su score y razones.
   */
  score(input: ScorerInput, topN: number = 10): ScoredVehicle[] {
    const scored: ScoredVehicle[] = [];

    for (const vehicle of input.availableVehicles) {
      let score = 0;
      const reasons: string[] = [];

      // ── Reglas basadas en preferencias del usuario ──

      if (input.preferences?.transmission) {
        if (vehicle.transmission.toLowerCase() === input.preferences.transmission.toLowerCase()) {
          score += SCORE_RULES.TRANSMISSION_MATCHES_PREFERENCE;
          reasons.push('Transmisión coincide con preferencia');
        }
      }

      if (input.preferences?.maxPriceDailyCents != null) {
        if (vehicle.basePriceCents <= input.preferences.maxPriceDailyCents) {
          score += SCORE_RULES.PRICE_WITHIN_PREFERENCE;
          reasons.push('Precio dentro del máximo diario preferido');
        }
      }

      if (
        input.preferences?.accessibility &&
        input.preferences.accessibility.length > 0 &&
        vehicle.isAccessible
      ) {
        score += SCORE_RULES.IS_ACCESSIBLE_MATCHES_PREFERENCE;
        reasons.push('Vehículo accesible (según preferencia)');
      }

      // ── Reglas basadas en historial de reservas ──

      const brandsInHistory = new Set(input.history.map((h) => h.brand.toLowerCase()));
      if (brandsInHistory.has(vehicle.brand.toLowerCase())) {
        score += SCORE_RULES.BRAND_IN_HISTORY;
        reasons.push(`Marca ${vehicle.brand} ya alquilada anteriormente`);
      }

      const provincesInHistory = new Set(input.history.map((h) => h.province.toLowerCase()));
      if (provincesInHistory.has(vehicle.province.toLowerCase())) {
        score += SCORE_RULES.PROVINCE_MATCHES_HISTORY;
        reasons.push('Ubicación similar a alquileres anteriores');
      }

      const historyTransmissions = new Set(input.history.map((h) => h.transmission.toLowerCase()));
      if (historyTransmissions.has(vehicle.transmission.toLowerCase())) {
        score += SCORE_RULES.SAME_TRANSMISSION_AS_HISTORY;
        reasons.push('Misma transmisión que alquileres previos');
      }

      if (input.history.length > 0) {
        const avgPassengers = input.history.reduce((sum, h) => sum + h.passengers, 0) / input.history.length;
        if (Math.abs(vehicle.passengers - avgPassengers) <= 2) {
          score += SCORE_RULES.PASSENGERS_MATCHES_HISTORY;
          reasons.push('Capacidad de pasajeros compatible con historial');
        }
      }

      // Características en común con vehículos alquilados
      const historyCharacteristics = new Set(input.history.flatMap((h) => h.characteristics.map((c) => c.toLowerCase())));
      for (const char of vehicle.characteristics) {
        if (historyCharacteristics.has(char.toLowerCase())) {
          score += SCORE_RULES.PER_CHARACTERISTIC_MATCH;
          reasons.push(`Característica "${char}" también presente en alquileres previos`);
        }
      }

      // ── Reglas basadas en favoritos ──

      if (input.favoriteVehicleIds.includes(vehicle.id)) {
        score += SCORE_RULES.IS_FAVORITE;
        reasons.push('Vehículo está en favoritos');
      }

      // ── Regla de re-reserva ──

      if (input.previouslyRentedVehicleIds.includes(vehicle.id)) {
        score += SCORE_RULES.WAS_RENTED_BEFORE;
        reasons.push('Vehículo alquilado anteriormente');
      }

      scored.push({ vehicle, score, reasons });
    }

    // Ordenar por score descendente
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topN);
  }

  /**
   * Encuentra alternativas cercanas para una búsqueda sin resultados exactos.
   * Relaja restricciones progresivamente y asigna un score de cercanía.
   */
  findNearAlternatives(
    availableVehicles: VehicleForScoring[],
    originalFilters: {
      brand?: string;
      model?: string;
      transmission?: string;
      maxPriceCents?: number;
      city?: string;
      province?: string;
      characteristics?: string[];
    },
    maxResults: number = 5,
  ): Array<{ vehicle: VehicleForScoring; score: number; differences: string[] }> {
    const results: Array<{ vehicle: VehicleForScoring; score: number; differences: string[] }> = [];

    for (const vehicle of availableVehicles) {
      let score = 0;
      const differences: string[] = [];

      // Nivel 1: Transmisión opuesta
      if (originalFilters.transmission) {
        if (vehicle.transmission.toLowerCase() !== originalFilters.transmission.toLowerCase()) {
          score += 10;
          differences.push(`Cambia transmisión: solicitaba ${originalFilters.transmission}, disponible ${vehicle.transmission}`);
        } else {
          score += 30;
        }
      }

      // Nivel 2: Precio
      if (originalFilters.maxPriceCents) {
        const priceRatio = vehicle.basePriceCents / originalFilters.maxPriceCents;
        if (priceRatio > 1.3) {
          differences.push(`Precio superior (${Math.round((priceRatio - 1) * 100)}% más que el máximo solicitado)`);
          score += 5;
        } else if (priceRatio > 1) {
          differences.push(`Precio levemente superior (${Math.round((priceRatio - 1) * 100)}% más)`);
          score += 15;
        } else if (priceRatio >= 0.7) {
          score += 25;
        } else {
          differences.push(`Precio inferior al solicitado`);
          score += 20;
        }
      }

      // Nivel 3: Ubicación
      if (originalFilters.city && vehicle.city.toLowerCase() !== originalFilters.city.toLowerCase()) {
        differences.push(`Ubicación distinta: solicitaba ${originalFilters.city}, está en ${vehicle.city}`);
        score += 8;
      } else if (originalFilters.city) {
        score += 15;
      }

      if (originalFilters.province && vehicle.province.toLowerCase() !== originalFilters.province.toLowerCase()) {
        if (!differences.some(d => d.includes('Ubicación'))) {
          differences.push(`Ubicación distinta: solicitaba ${originalFilters.province}, está en ${vehicle.province}`);
        }
        score += 5;
      } else if (originalFilters.province) {
        score += 10;
      }

      // Nivel 4: Marca/modelo
      if (originalFilters.brand && vehicle.brand.toLowerCase() !== originalFilters.brand.toLowerCase()) {
        differences.push(`Marca distinta: solicitaba ${originalFilters.brand}, es ${vehicle.brand}`);
        score += 5;
      } else if (originalFilters.brand) {
        score += 20;
      }

      // Nivel 5: Características
      if (originalFilters.characteristics && originalFilters.characteristics.length > 0) {
        const vehicleChars = new Set(vehicle.characteristics.map(c => c.toLowerCase()));
        const missing = originalFilters.characteristics.filter(c => !vehicleChars.has(c.toLowerCase()));
        if (missing.length > 0) {
          differences.push(`No tiene: ${missing.join(', ')}`);
          score += 3;
        } else {
          score += 10;
        }
      }

      results.push({ vehicle, score, differences });
    }

    // Ordenar por score descendente (mayor cercanía primero)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, maxResults);
  }
}
