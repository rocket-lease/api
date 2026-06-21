import { When, Then, DataTable } from '@cucumber/cucumber';
import { MyWorld } from '../support/world';
import { api } from '../support/http-client';
import { expect } from 'expect';

const SEARCHABLE_FIELDS: Record<string, string> = {
  marca: 'brand',
  modelo: 'model',
  año: 'year',
  'precio máximo': 'maxPrice',
  transmisión: 'transmission',
};

function buildSearchQuery(dataTable: DataTable): URLSearchParams {
  const rawData = dataTable.hashes()[0];
  const params = new URLSearchParams();

  for (const [spanishKey, englishKey] of Object.entries(SEARCHABLE_FIELDS)) {
    const value = rawData[spanishKey]?.trim();
    if (value !== undefined && value !== '') {
      params.set(englishKey, value);
    }
  }

  return params;
}

When(
  'busco vehículos con los siguientes criterios:',
  async function (this: MyWorld, dataTable: DataTable) {
    const query = buildSearchQuery(dataTable);
    const queryString = query.toString();

    // Exact search — GET /vehicle with filters
    this.world.search_response = await api(this).get(`/vehicle?${queryString}`);

    // Alternative suggestions — GET /search/alternatives with same filters
    this.world.alternatives_response = await api(this).get(
      `/search/alternatives?${queryString}`,
    );
  },
);

Then(
  'el sistema muestra {int} resultados exactos',
  function (this: MyWorld, expectedCount: number) {
    const response = this.world.search_response;
    expect(response.status).toBe(200);
    const results = Array.isArray(response.body)
      ? response.body
      : response.body.results ?? [];
    expect(results.length).toBe(expectedCount);
  },
);

Then(
  'el sistema muestra al menos {int} resultado exacto',
  function (this: MyWorld, minCount: number) {
    const response = this.world.search_response;
    expect(response.status).toBe(200);
    const results = Array.isArray(response.body)
      ? response.body
      : response.body.results ?? [];
    expect(results.length).toBeGreaterThanOrEqual(minCount);
  },
);

Then(
  'el sistema sugiere alternativas cercanas',
  function (this: MyWorld) {
    const response = this.world.alternatives_response;
    expect(response.status).toBe(200);
    const alternatives = Array.isArray(response.body)
      ? response.body
      : response.body.alternatives ?? [];
    expect(alternatives.length).toBeGreaterThan(0);
  },
);

Then(
  'el sistema no sugiere alternativas',
  function (this: MyWorld) {
    const response = this.world.alternatives_response;
    expect(response.status).toBe(200);
    const alternatives = Array.isArray(response.body)
      ? response.body
      : response.body.alternatives ?? [];
    expect(alternatives.length).toBe(0);
  },
);

Then(
  'el sistema indica que no hay alternativas cercanas',
  function (this: MyWorld) {
    const response = this.world.alternatives_response;
    expect(response.status).toBe(200);
    // Either an empty array or a body with a message field
    if (Array.isArray(response.body)) {
      expect(response.body.length).toBe(0);
    } else {
      const alternatives = response.body.alternatives ?? [];
      expect(alternatives.length).toBe(0);
      // Optionally verify there is a descriptive message
      expect(response.body.message ?? '').toBeTruthy();
    }
  },
);

Then(
  'las alternativas muestran las diferencias claramente indicadas',
  function (this: MyWorld) {
    const response = this.world.alternatives_response;
    expect(response.status).toBe(200);
    const alternatives = response.body.alternatives ?? response.body;
    expect(alternatives.length).toBeGreaterThan(0);

    for (const alt of alternatives) {
      // Each alternative must include a differences / diff field
      const diff = alt.differences ?? alt.diff ?? alt.reason;
      expect(diff).toBeDefined();
      // Differences must be non-empty (contain at least one diff item or a string)
      if (Array.isArray(diff)) {
        expect(diff.length).toBeGreaterThan(0);
        for (const d of diff) {
          expect(typeof d).toBe('string');
          expect(d.length).toBeGreaterThan(0);
        }
      } else if (typeof diff === 'string') {
        expect(diff.length).toBeGreaterThan(0);
      }
    }
  },
);

Then(
  'las alternativas se muestran ordenadas por cercanía',
  function (this: MyWorld) {
    const response = this.world.alternatives_response;
    expect(response.status).toBe(200);
    const alternatives = response.body.alternatives ?? response.body;
    expect(alternatives.length).toBeGreaterThan(0);

    // Verify ordering — alternatives must have a relevanceScore or order field
    // that is monotonically decreasing (most relevant first)
    for (let i = 1; i < alternatives.length; i++) {
      const prev = alternatives[i - 1];
      const curr = alternatives[i];
      const prevScore =
        prev.relevanceScore ?? prev.score ?? prev.relevance ?? 0;
      const currScore =
        curr.relevanceScore ?? curr.score ?? curr.relevance ?? 0;
      expect(prevScore).toBeGreaterThanOrEqual(currScore);
    }
  },
);

Then(
  'las alternativas indican en qué se diferencian de los criterios buscados',
  function (this: MyWorld) {
    const response = this.world.alternatives_response;
    expect(response.status).toBe(200);
    const alternatives = response.body.alternatives ?? response.body;
    expect(alternatives.length).toBeGreaterThan(0);

    for (const alt of alternatives) {
      const diff = alt.differences ?? alt.diff ?? alt.reason;
      expect(diff).toBeDefined();

      if (Array.isArray(diff)) {
        expect(diff.length).toBeGreaterThan(0);
        for (const d of diff) {
          expect(typeof d).toBe('string');
          // Each diff description should be meaningful — at least 3 chars
          expect(d.length).toBeGreaterThanOrEqual(3);
        }
      } else if (typeof diff === 'string') {
        expect(diff.length).toBeGreaterThan(0);
      }

      // The alternative vehicle itself must be defined
      const vehicle = alt.vehicle ?? alt;
      expect(vehicle.id ?? vehicle.plate ?? vehicle.patente).toBeDefined();
    }
  },
);
